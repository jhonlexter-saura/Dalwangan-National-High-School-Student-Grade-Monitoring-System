const crypto = require("crypto");
const nodemailer = require("nodemailer");

const IntegrationSetting = require("../models/IntegrationSetting");
const IntegrationSecurityGrant = require("../models/IntegrationSecurityGrant");
const User = require("../models/User");
const {
  hashValue,
  hashCode,
  hashPayload,
  consumeApproval,
} = require("../middleware/integrationSecurity");
const { sendIntegrationSecurityEmail } = require("../utils/mailer");
const { logAudit } = require("../services/auditLogger");
const {
  CUSTOM_ENV_KEYS,
  getCustomConfigStatus,
  saveCustomConfig,
} = require("../services/customConfiguration");
const {
  readSettings,
  effectiveValue,
  respondCustomConfigError,
} = require("../services/integrationConfig");

const SECURITY_RECORD_LIFETIME_MS = 24 * 60 * 60 * 1000;
const SECURITY_CODE_LIFETIME_MS = 5 * 60 * 1000;
const INTEGRATION_SESSION_LIFETIME_MS = 15 * 60 * 1000;

/* ---------- helpers (used only by this controller) ---------- */

async function findConfiguredSuperUser() {
  const configuredEmail = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
  if (!configuredEmail) return null;
  return User.findOne({
    email: configuredEmail,
    role: "admin",
    status: "active",
  }).select("name email role status");
}

// request-access and request-approval both issued a one-time code the same way.
async function createCodeGrant(req, superUser, extraFields) {
  const code = String(crypto.randomInt(10000000, 100000000));
  const now = Date.now();
  const grant = await IntegrationSecurityGrant.create({
    adminId: req.authenticatedUser._id,
    superUserId: superUser._id,
    superUserEmail: superUser.email,
    codeHash: hashCode("pending", code),
    codeExpiresAt: new Date(now + SECURITY_CODE_LIFETIME_MS),
    expiresAt: new Date(now + SECURITY_RECORD_LIFETIME_MS),
    ...extraFields,
  });
  grant.codeHash = hashCode(String(grant._id), code);
  await grant.save();
  return { grant, code };
}

/* ---------- public ---------- */

// Exposes integration status only, never secret keys.
async function getPublicSettings(req, res) {
  try {
    const settings = await readSettings();
    return res.json({
      success: true,
      settings: {
        googleSignIn: settings.googleSignIn,
        recaptcha: settings.recaptcha,
        googleClientId:
          effectiveValue("CUSTOM_VITE_GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID") ||
          effectiveValue("CUSTOM_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"),
        recaptchaSiteKey: effectiveValue("CUSTOM_VITE_RECAPTCHA_SITE_KEY", "VITE_RECAPTCHA_SITE_KEY"),
      },
    });
  } catch (error) {
    console.error("Public integration settings error:", error);
    return res.status(500).json({ error: "Unable to load integration settings." });
  }
}

/* ---------- security (admin only) ---------- */

// POST /security/request-access
async function requestAccess(req, res) {
  try {
    const suppliedEmail =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const configuredEmail = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
    if (!configuredEmail) {
      return res
        .status(503)
        .json({ error: "Super-user access is not configured on this server." });
    }
    if (!suppliedEmail || suppliedEmail !== configuredEmail) {
      return res.status(403).json({ error: "The super-user email could not be verified." });
    }

    const superUser = await findConfiguredSuperUser();
    if (!superUser) {
      return res.status(503).json({
        error: "The configured super-user must be an active administrator account.",
      });
    }

    const { grant, code } = await createCodeGrant(req, superUser, { purpose: "access-otp" });

    try {
      await sendIntegrationSecurityEmail({
        to: superUser.email,
        subject: "DNHS-SGMS integration access verification",
        text: [
          `An administrator (${req.authenticatedUser._id}) requested access to critical integration settings.`,
          `Share this one-time verification code with them: ${code}`,
          "The code expires in 5 minutes. If you did not authorize this request, do not share it.",
        ].join("\n\n"),
      });
    } catch (mailError) {
      await IntegrationSecurityGrant.deleteOne({ _id: grant._id });
      console.error("Integration access email error:", mailError);
      return res
        .status(503)
        .json({ error: "Unable to send the super-user verification code." });
    }

    await logAudit({
      req,
      action: "INTEGRATION_ACCESS_CODE_REQUESTED",
      category: "system",
      target: { entityType: "IntegrationSecurity", name: "Admin integration access" },
      description: "Requested a super-user verification code for integration access.",
      details: { superUserId: String(superUser._id) },
    });

    return res.json({
      success: true,
      challengeId: String(grant._id),
      message:
        "A verification code was sent to the configured super user. It expires in 5 minutes.",
    });
  } catch (error) {
    console.error("Integration access code request error:", error);
    return res.status(500).json({ error: "Unable to request integration access." });
  }
}

// POST /security/verify-access (code format validated by middleware)
async function verifyAccess(req, res) {
  try {
    const { challengeId, code } = req.verifyAccess;

    const now = new Date();
    const grant = await IntegrationSecurityGrant.findOneAndUpdate(
      {
        _id: challengeId,
        adminId: req.authenticatedUser._id,
        purpose: "access-otp",
        codeHash: hashCode(String(challengeId), code),
        codeExpiresAt: { $gt: now },
        expiresAt: { $gt: now },
        consumedAt: null,
        attemptCount: { $lt: 5 },
      },
      { $set: { consumedAt: now }, $unset: { codeHash: "" } },
      { new: true }
    );

    if (!grant) {
      await IntegrationSecurityGrant.updateOne(
        {
          _id: challengeId,
          adminId: req.authenticatedUser._id,
          purpose: "access-otp",
          codeExpiresAt: { $gt: now },
          expiresAt: { $gt: now },
          consumedAt: null,
          attemptCount: { $lt: 5 },
        },
        { $inc: { attemptCount: 1 } }
      );
      await logAudit({
        req,
        action: "INTEGRATION_ACCESS_VERIFICATION_FAILED",
        category: "system",
        target: { entityType: "IntegrationSecurity", name: "Admin integration access" },
        description: "A super-user integration access code was invalid or expired.",
        details: { failureReason: "invalid_or_expired_code" },
        status: "failed",
      });
      return res.status(401).json({ error: "The verification code is invalid or expired." });
    }

    await IntegrationSecurityGrant.deleteMany({
      adminId: grant.adminId,
      purpose: "access-session",
    });

    const accessToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiresAt = new Date(Date.now() + INTEGRATION_SESSION_LIFETIME_MS);
    const session = await IntegrationSecurityGrant.create({
      adminId: grant.adminId,
      superUserId: grant.superUserId,
      superUserEmail: grant.superUserEmail,
      purpose: "access-session",
      accessTokenHash: hashValue(accessToken),
      expiresAt: sessionExpiresAt,
    });

    await logAudit({
      req,
      action: "INTEGRATION_ACCESS_GRANTED",
      category: "system",
      target: {
        entityType: "IntegrationSecurity",
        entityId: String(session._id),
        name: "Admin integration access",
      },
      description: "Verified super-user code and granted temporary integration access.",
      details: {
        superUserId: String(grant.superUserId),
        expiresAt: sessionExpiresAt,
        sessionMinutes: 15,
      },
    });

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      accessToken,
      expiresAt: sessionExpiresAt,
      expiresInSeconds: INTEGRATION_SESSION_LIFETIME_MS / 1000,
    });
  } catch (error) {
    console.error("Integration access verification error:", error);
    return res.status(500).json({ error: "Unable to verify integration access." });
  }
}

// POST /security/revoke-access
async function revokeAccess(req, res) {
  try {
    const result = await IntegrationSecurityGrant.deleteMany({
      adminId: req.authenticatedUser._id,
      purpose: "access-session",
    });

    await logAudit({
      req,
      action: "INTEGRATION_ACCESS_REVOKED",
      category: "system",
      target: { entityType: "IntegrationSecurity", name: "Admin integration access" },
      description: "Revoked active integration access session upon logout or session exit.",
      details: { revokedCount: result.deletedCount },
    });

    return res.json({ success: true, message: "Integration access revoked." });
  } catch (error) {
    console.error("Integration access revocation error:", error);
    return res.status(500).json({ error: "Unable to revoke integration access." });
  }
}

// POST /security/request-approval (request shape validated by middleware)
async function requestApproval(req, res) {
  try {
    const request = req.approvalRequest;

    const superUser = await findConfiguredSuperUser();
    if (!superUser) {
      return res.status(503).json({
        error: "The configured super-user must be an active administrator account.",
      });
    }

    const { grant, code: pin } = await createCodeGrant(req, superUser, {
      purpose: "change-approval",
      action: request.action,
      payloadHash: hashPayload(request.payload),
    });

    try {
      await sendIntegrationSecurityEmail({
        to: superUser.email,
        subject: "DNHS-SGMS integration change approval",
        text: [
          `An administrator (${req.authenticatedUser._id}) requested approval for: ${request.description}.`,
          `Share this one-time approval PIN with them: ${pin}`,
          "The PIN expires in 5 minutes and authorizes only this specific change once. If you did not authorize this request, do not share it.",
        ].join("\n\n"),
      });
    } catch (mailError) {
      await IntegrationSecurityGrant.deleteOne({ _id: grant._id });
      console.error("Integration approval email error:", mailError);
      return res
        .status(503)
        .json({ error: "Unable to send the approval PIN to the super user." });
    }

    await logAudit({
      req,
      action: "INTEGRATION_CHANGE_APPROVAL_REQUESTED",
      category: "system",
      target: {
        entityType: "IntegrationSecurity",
        entityId: String(grant._id),
        name: request.description,
      },
      description: `Requested super-user approval for ${request.description}.`,
      details: { action: request.action, superUserId: String(superUser._id) },
    });

    return res.json({
      success: true,
      approvalId: String(grant._id),
      expiresInSeconds: SECURITY_CODE_LIFETIME_MS / 1000,
      message: "An approval PIN was emailed to the super user. It authorizes this exact change once.",
    });
  } catch (error) {
    console.error("Integration approval request error:", error);
    return res.status(500).json({ error: "Unable to request super-user approval." });
  }
}

// POST /security/verify-approval (action validated by middleware)
async function verifyApproval(req, res) {
  try {
    const { action, payload } = req.approvalVerification;

    const approved = await consumeApproval(req, { action, payload });
    if (!approved) {
      return res.status(403).json({ error: "The super-user PIN is invalid or expired." });
    }

    const configToken = crypto.randomBytes(32).toString("hex");
    await IntegrationSecurityGrant.create({
      adminId: req.authenticatedUser._id,
      superUserId: req.integrationAccess.superUserId,
      superUserEmail: req.integrationAccess.superUserEmail,
      purpose: "access-session",
      accessTokenHash: hashValue(configToken),
      action: `config-unlocked:${payload?.target}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await logAudit({
      req,
      action: "INTEGRATION_CONFIG_UNLOCKED",
      category: "system",
      target: {
        entityType: "IntegrationSecurity",
        name: `Unlocked ${payload?.target} configuration`,
      },
      description: `Super-user PIN verified to unlock custom configuration for ${payload?.target}.`,
      details: { target: payload?.target },
    });

    return res.json({
      success: true,
      configToken,
      target: payload?.target,
      message: "Custom configuration unlocked.",
    });
  } catch (error) {
    console.error("Verify configure approval error:", error);
    return res.status(500).json({ error: "Unable to verify super-user PIN." });
  }
}

/* ---------- settings ---------- */

// GET /
async function getSettings(req, res) {
  try {
    return res.json({
      success: true,
      settings: await readSettings(),
      customConfig: getCustomConfigStatus(),
    });
  } catch (error) {
    console.error("Read integration settings error:", error);
    return res.status(500).json({ error: "Unable to load integration settings." });
  }
}

// PUT /custom-config (shape, key-change guard and values already validated by middleware)
async function updateCustomConfig(req, res) {
  try {
    const updates = req.customConfigUpdates;

    const configToken = req.get("x-su-config-token");
    let authorized = false;

    if (configToken && /^[a-f0-9]{64}$/i.test(configToken)) {
      const updatedKeys = Object.keys(updates);
      const isGoogle = updatedKeys.some((k) => k.includes("GOOGLE"));
      const isRecaptcha = updatedKeys.some((k) => k.includes("RECAPTCHA"));
      const isEmail = updatedKeys.some((k) => k.includes("EMAIL"));
      const isToken = updatedKeys.some((k) => k.includes("AUTH_TOKEN") || k.includes("DATABASE"));
      const targetGroup = isGoogle
        ? "google"
        : isRecaptcha
          ? "recaptcha"
          : isEmail
            ? "email"
            : isToken
              ? "token"
              : null;

      const grant = await IntegrationSecurityGrant.findOne({
        adminId: req.authenticatedUser._id,
        purpose: "access-session",
        accessTokenHash: hashValue(configToken),
        ...(targetGroup ? { action: `config-unlocked:${targetGroup}` } : {}),
        expiresAt: { $gt: new Date() },
      });

      if (grant) {
        authorized = true;
      }
    }

    if (!authorized) {
      const approved = await consumeApproval(req, { action: "custom-config", payload: updates });
      if (!approved) {
        return res.status(403).json({
          error:
            "Super-user authorization required. Please click Configure and verify with the super-user PIN.",
        });
      }
    }

    await saveCustomConfig(updates);

    logAudit({
      req,
      action: "CUSTOM_INTEGRATION_CONFIG_UPDATED",
      category: "system",
      target: { entityType: "IntegrationConfig", name: "Custom integration configuration" },
      description: "Updated custom integration configuration",
      details: {
        changedSettings: Object.keys(updates),
        customOverridesEnabled: Object.fromEntries(
          Object.entries(updates).map(([key, value]) => [key, Boolean(value)])
        ),
      },
    });

    const restartRequired = Object.keys(updates).some((key) => CUSTOM_ENV_KEYS[key].requiresRestart);
    return res.json({
      success: true,
      customConfig: getCustomConfigStatus(),
      restartRequired,
      message: restartRequired
        ? "Custom settings saved. Restart the server to apply the database or token secret change."
        : "Custom settings saved and applied.",
    });
  } catch (error) {
    return respondCustomConfigError(res, error);
  }
}

// PATCH / (toggle validated by middleware)
async function updateSetting(req, res) {
  try {
    const { key, value } = req.settingToggle;

    const previous = await readSettings();
    const approved = await consumeApproval(req, {
      action: "toggle-setting",
      payload: { key, value },
    });
    if (!approved) {
      return res.status(403).json({
        error: "A valid, unused super-user PIN is required for this exact integration change.",
      });
    }

    await IntegrationSetting.findOneAndUpdate(
      { key: "global" },
      {
        $set: { [key]: value, updatedBy: req.authenticatedUser._id },
        $setOnInsert: { key: "global" },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    logAudit({
      req,
      action: "INTEGRATION_SETTING_CHANGED",
      category: "system",
      target: { entityType: "IntegrationSetting", entityId: "global", name: key },
      description: `${key} ${value ? "enabled" : "disabled"}`,
      details: { setting: key, before: previous[key], after: value },
    });

    return res.json({
      success: true,
      settings: await readSettings(),
      message: `${
        {
          googleSignIn: "Google Sign-In",
          recaptcha: "reCAPTCHA",
          emailMailer: "Email Mailer",
        }[key]
      } ${value ? "enabled" : "disabled"} successfully.`,
    });
  } catch (error) {
    console.error("Update integration settings error:", error);
    return res.status(500).json({ error: "Unable to save integration settings." });
  }
}

// POST /test-recaptcha (requires verified integration-access session)
async function testRecaptchaCredentials(req, res) {
  try {
    const { siteKey, secretKey, responseToken } = req.body || {};

    // Layer 1 — Input validation
    if (!siteKey || typeof siteKey !== "string" || !siteKey.trim()) {
      return res.status(400).json({ error: "Site key is required." });
    }
    if (!secretKey || typeof secretKey !== "string" || !secretKey.trim()) {
      return res.status(400).json({ error: "Secret key is required." });
    }
    if (!responseToken || typeof responseToken !== "string" || !responseToken.trim()) {
      return res.status(400).json({
        error: "reCAPTCHA response token is required. Complete the test challenge in the browser.",
      });
    }

    const trimmedSiteKey = siteKey.trim().replace(/^["']|["']$/g, "");
    const trimmedSecretKey = secretKey.trim().replace(/^["']|["']$/g, "");
    const trimmedToken = responseToken.trim();

    const KEY_FORMAT_REGEX = /^[A-Za-z0-9_-]{25,100}$/;
    if (!KEY_FORMAT_REGEX.test(trimmedSiteKey)) {
      return res.status(400).json({
        error: "Invalid site key format. Expected 30–60 letters, numbers, hyphens, or underscores.",
      });
    }
    if (!KEY_FORMAT_REGEX.test(trimmedSecretKey)) {
      return res.status(400).json({
        error: "Invalid secret key format. Expected 30–60 letters, numbers, hyphens, or underscores.",
      });
    }
    if (trimmedToken.length < 20) {
      return res.status(400).json({
        error: "Invalid response token format.",
      });
    }

    // Layer 2 & 3 — Provider verification with Google siteverify
    const remoteIp = req.ip || req.socket?.remoteAddress;
    const params = new URLSearchParams({
      secret: trimmedSecretKey,
      response: trimmedToken,
    });
    if (
      remoteIp &&
      remoteIp !== "127.0.0.1" &&
      remoteIp !== "::1" &&
      !remoteIp.startsWith("::ffff:127.")
    ) {
      params.set("remoteip", remoteIp);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const googleRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!googleRes.ok) {
      return res.status(502).json({
        error: "Google reCAPTCHA verification service is currently unreachable. Please check your network and try again.",
      });
    }

    const result = await googleRes.json();

    if (result.success !== true) {
      const errorCodes = result["error-codes"] || [];
      let friendlyMessage = "reCAPTCHA verification failed.";
      if (errorCodes.includes("invalid-input-secret")) {
        friendlyMessage = "Google rejected the secret key (invalid-input-secret). Verify your private secret key in the Google reCAPTCHA admin console.";
      } else if (errorCodes.includes("invalid-input-response")) {
        friendlyMessage = "Google rejected the response token (invalid-input-response). The site key and secret key may not belong to the same reCAPTCHA project or key pair.";
      } else if (errorCodes.includes("bad-request")) {
        friendlyMessage = "Google rejected the verification request (bad-request). Verify key configuration.";
      } else if (errorCodes.includes("timeout-or-duplicate")) {
        friendlyMessage = "The response token has expired or was already used. Please click Test Credentials again.";
      }
      return res.status(400).json({
        success: false,
        verified: false,
        error: friendlyMessage,
        errorCodes,
      });
    }

    await logAudit({
      req,
      action: "RECAPTCHA_CREDENTIALS_TESTED",
      category: "system",
      target: { entityType: "IntegrationConfig", name: "reCAPTCHA v3 verification" },
      description: "Tested and verified reCAPTCHA credentials with Google.",
      details: {
        score: result.score,
        action: result.action,
        hostname: result.hostname,
        siteKeyPreview: `${trimmedSiteKey.slice(0, 8)}...${trimmedSiteKey.slice(-4)}`,
      },
    });

    return res.json({
      success: true,
      verified: true,
      score: result.score,
      action: result.action,
      hostname: result.hostname,
      message: "reCAPTCHA credentials verified successfully with Google.",
    });
  } catch (error) {
    console.error("Test reCAPTCHA credentials error:", error);
    if (error.name === "AbortError") {
      return res.status(504).json({ error: "Google verification request timed out. Please try again." });
    }
    return res.status(500).json({ error: "Unable to verify credentials with Google." });
  }
}

// POST /test-mailer (requires verified integration-access session)
async function testMailerCredentials(req, res) {
  try {
    const { emailUser, emailPassword } = req.body || {};

    // Layer 1 — Input validation
    if (!emailUser || typeof emailUser !== "string" || !emailUser.trim()) {
      return res.status(400).json({ error: "Gmail account email is required." });
    }
    if (!emailPassword || typeof emailPassword !== "string" || !emailPassword.trim()) {
      return res.status(400).json({ error: "Gmail app password is required." });
    }

    const trimmedUser = emailUser.trim().toLowerCase();
    const trimmedPass = emailPassword.trim().replace(/\s+/g, "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUser)) {
      return res.status(400).json({
        error: "Invalid email address format. Enter a valid email address.",
      });
    }

    if (!/^[a-zA-Z0-9]{16}$/.test(trimmedPass)) {
      return res.status(400).json({
        error: "Invalid Gmail app password format. Google App Passwords must be 16 characters (letters or numbers).",
      });
    }

    // Layer 2 & 3 — Provider verification with Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: trimmedUser,
        pass: trimmedPass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });

    try {
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection to Gmail SMTP timed out.")), 8500)
        ),
      ]);
    } catch (mailError) {
      let friendlyMessage = `Gmail SMTP verification failed: ${mailError.message || "Authentication failed"}.`;
      if (
        mailError.responseCode === 535 ||
        String(mailError.message).includes("535") ||
        String(mailError.message).includes("Invalid login")
      ) {
        friendlyMessage =
          "Google rejected the Gmail credentials (535 Invalid login). Please ensure 2-Step Verification is active on your Google account and use a generated 16-character App Password (not your personal password).";
      } else if (
        mailError.code === "ETIMEDOUT" ||
        mailError.code === "ECONNREFUSED" ||
        mailError.code === "ENOTFOUND" ||
        mailError.message?.includes("timed out")
      ) {
        friendlyMessage =
          "Unable to connect to Gmail SMTP server (smtp.gmail.com). Please check your server internet connectivity and try again.";
      }
      return res.status(400).json({
        success: false,
        verified: false,
        error: friendlyMessage,
      });
    }

    // Mask user email for audit log
    const [userLocal, userDomain] = trimmedUser.split("@");
    const maskedLocal =
      userLocal.length <= 2 ? userLocal : `${userLocal.slice(0, 2)}***${userLocal.slice(-1)}`;
    const maskedEmail = `${maskedLocal}@${userDomain}`;

    await logAudit({
      req,
      action: "EMAIL_CREDENTIALS_TESTED",
      category: "system",
      target: { entityType: "IntegrationConfig", name: "Gmail SMTP verification" },
      description: "Tested and verified email mailer credentials with Gmail SMTP.",
      details: {
        mailerAccount: maskedEmail,
      },
    });

    return res.json({
      success: true,
      verified: true,
      message: "Gmail SMTP authentication successful. Credentials verified with Google.",
    });
  } catch (error) {
    console.error("Test mailer credentials error:", error);
    return res.status(500).json({ error: "Unable to verify credentials with Gmail." });
  }
}

// POST /test-google (requires verified integration-access session)
async function testGoogleCredentials(req, res) {
  try {
    const { googleClientId, googleClientSecret, googleTokenKey } = req.body || {};

    // Layer 1 — Input validation
    if (!googleClientId || typeof googleClientId !== "string" || !googleClientId.trim()) {
      return res.status(400).json({ error: "Google OAuth Client ID is required." });
    }
    if (!googleClientSecret || typeof googleClientSecret !== "string" || !googleClientSecret.trim()) {
      return res.status(400).json({ error: "Google OAuth Client Secret is required." });
    }
    if (!googleTokenKey || typeof googleTokenKey !== "string" || !googleTokenKey.trim()) {
      return res.status(400).json({ error: "Google token encryption key is required." });
    }

    const trimmedClientId = googleClientId.trim().replace(/^["']|["']$/g, "");
    const trimmedClientSecret = googleClientSecret.trim().replace(/^["']|["']$/g, "");
    const trimmedTokenKey = googleTokenKey.trim().replace(/^["']|["']$/g, "");

    if (!/^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i.test(trimmedClientId)) {
      return res.status(400).json({
        error: "Invalid Google OAuth Client ID format. Must end in .apps.googleusercontent.com.",
      });
    }

    if (trimmedClientSecret.length < 16) {
      return res.status(400).json({
        error: "Invalid Google OAuth Client Secret format. Expected at least 16 characters.",
      });
    }

    if (Buffer.byteLength(trimmedTokenKey) < 32) {
      return res.status(400).json({
        error: "Google token encryption key must be at least 32 bytes long (32+ characters).",
      });
    }

    // Verify token encryption key works with AES-256-GCM
    try {
      const keyBuf = crypto.createHash("sha256").update(trimmedTokenKey).digest();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
      let enc = cipher.update("dnhs_test_payload", "utf8", "hex");
      enc += cipher.final("hex");
      const tag = cipher.getAuthTag();
      const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv);
      decipher.setAuthTag(tag);
      let dec = decipher.update(enc, "hex", "utf8");
      dec += decipher.final("utf8");
      if (dec !== "dnhs_test_payload") {
        throw new Error("Encryption verification failed");
      }
    } catch {
      return res.status(400).json({
        error: "Invalid token encryption key: unable to initialize AES-256-GCM cipher.",
      });
    }

    // Layer 2 & 3 — Provider verification against Google OAuth
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      "http://localhost:5000/api/v1/integrations/google/callback";
    const params = new URLSearchParams({
      client_id: trimmedClientId,
      client_secret: trimmedClientSecret,
      grant_type: "authorization_code",
      code: "dnhs_probe_token_validation",
      redirect_uri: redirectUri,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const googleRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!googleRes.ok) {
      const result = await googleRes.json().catch(() => ({}));
      // If HTTP 401 or invalid_client, Google rejected the client credentials
      if (googleRes.status === 401 || result.error === "invalid_client") {
        let desc = result.error_description || "Unauthorized";
        if (desc.includes("The OAuth client was not found")) {
          return res.status(400).json({
            success: false,
            verified: false,
            error:
              "Google could not find this OAuth client. Check that the Client ID is correct and active in Google Cloud Console.",
          });
        }
        return res.status(400).json({
          success: false,
          verified: false,
          error:
            "Google rejected the OAuth client credentials (invalid_client: Unauthorized). Verify your Client ID and Client Secret in Google Cloud Console.",
        });
      }

      // If HTTP 400 with invalid_grant, Google authenticated the client successfully and rejected only the dummy probe authorization code
      if (googleRes.status === 400 && result.error === "invalid_grant") {
        // Authenticated successfully!
      } else {
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Google verification returned ${result.error || "an error"}: ${result.error_description || "Unable to verify credentials."}`,
        });
      }
    }

    // Audit log (masked preview of client ID only)
    const clientPrefix = trimmedClientId.split("-")[0] || trimmedClientId.slice(0, 8);
    await logAudit({
      req,
      action: "GOOGLE_CREDENTIALS_TESTED",
      category: "system",
      target: { entityType: "IntegrationConfig", name: "Google OAuth verification" },
      description: "Tested and verified Google OAuth credentials with Google OAuth2.",
      details: {
        clientIdPreview: `${clientPrefix.slice(0, 8)}...apps.googleusercontent.com`,
      },
    });

    return res.json({
      success: true,
      verified: true,
      message: "Google OAuth credentials verified successfully with Google.",
    });
  } catch (error) {
    console.error("Test Google credentials error:", error);
    if (error.name === "AbortError") {
      return res.status(504).json({ error: "Google verification request timed out. Please try again." });
    }
    return res.status(500).json({ error: "Unable to verify credentials with Google." });
  }
}

module.exports = {
  getPublicSettings,
  requestAccess,
  verifyAccess,
  revokeAccess,
  requestApproval,
  verifyApproval,
  getSettings,
  updateCustomConfig,
  updateSetting,
  testRecaptchaCredentials,
  testMailerCredentials,
  testGoogleCredentials,
};