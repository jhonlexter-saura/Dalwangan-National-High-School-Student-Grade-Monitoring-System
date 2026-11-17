const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const IntegrationSetting = require("../models/IntegrationSetting");
const IntegrationSecurityGrant = require("../models/IntegrationSecurityGrant");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/authorization");
const { requireIntegrationAccess, hashValue, hashCode, hashPayload, consumeApproval } = require("../middleware/integrationSecurity");
const { sendIntegrationSecurityEmail } = require("../utils/mailer");
const { limits: authRateLimits } = require("../middleware/authRateLimit");
const { logAudit } = require("../services/auditLogger");
const GoogleIntegration = require("../models/GoogleIntegration");
const {
  CUSTOM_ENV_KEYS,
  getCustomConfigStatus,
  saveCustomConfig,
} = require("../services/customConfiguration");

const router = express.Router();

const DEFAULTS = {
  googleSignIn: true,
  recaptcha: true,
  emailMailer: true,
};

async function readSettings() {
  const document = await IntegrationSetting.findOne({
    key: "global",
  }).lean();

  return {
    googleSignIn: document?.googleSignIn ?? DEFAULTS.googleSignIn,
    recaptcha: document?.recaptcha ?? DEFAULTS.recaptcha,
    emailMailer: document?.emailMailer ?? DEFAULTS.emailMailer,
  };
}

function effectiveValue(customKey, defaultKey) {
  let val = process.env[customKey]?.trim() || process.env[defaultKey]?.trim() || "";
  if (!val && customKey === "CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY") {
    val = process.env.AUTH_TOKEN_SECRET?.trim() || "";
  }
  return val.replace(/^["']|["']$/g, "").trim();
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function validateCustomValues(updates) {
  const databaseUri = updates.CUSTOM_DATABASE_URI;
  if (databaseUri) {
    if (!/^mongodb(?:\+srv)?:\/\//i.test(databaseUri)) {
      throw validationError("Enter a valid MongoDB connection URI.");
    }
    let probe;
    try {
      probe = mongoose.createConnection(databaseUri, { serverSelectionTimeoutMS: 8000 });
      await probe.asPromise();
    } catch {
      throw validationError("Could not connect using that database URI. Check the address, credentials, network access, and database access list.");
    } finally {
      if (probe) await probe.close().catch(() => {});
    }
  }

  if (updates.CUSTOM_AUTH_TOKEN_SECRET && Buffer.byteLength(updates.CUSTOM_AUTH_TOKEN_SECRET) < 32) {
    throw validationError("The custom token secret must be at least 32 bytes long.");
  }

  const googleClientId = updates.CUSTOM_GOOGLE_CLIENT_ID || updates.CUSTOM_VITE_GOOGLE_CLIENT_ID;
  if (googleClientId) {
    if (!/^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i.test(googleClientId)) {
      throw validationError("Enter a valid Google OAuth Client ID ending in .apps.googleusercontent.com.");
    }
    try {
      const probeUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&response_type=token&redirect_uri=http%3A%2F%2Flocalhost&scope=email`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const probeRes = await fetch(probeUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (DNHS-SGMS Credential Verifier)" },
      });
      clearTimeout(timeoutId);
      const probeText = await probeRes.text();
      if (
        probeRes.status === 400 ||
        probeText.includes("invalid_client") ||
        probeText.includes("The OAuth client was not found") ||
        probeText.includes("deleted_client")
      ) {
        throw validationError("Google returned an invalid reply: OAuth Client ID was not recognized by Google. Verify that the client ID is correct and active in Google Cloud Console.");
      }
    } catch (probeError) {
      if (probeError.statusCode === 400) throw probeError;
      console.warn("Google Client ID verification network probe note:", probeError.message);
    }
  }

  if (updates.CUSTOM_GOOGLE_CLIENT_SECRET && updates.CUSTOM_GOOGLE_CLIENT_SECRET.trim().length < 8) {
    throw validationError("The Google OAuth Client Secret looks too short.");
  }

  if (updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY && Buffer.byteLength(updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY.trim()) < 32) {
    throw validationError("The Google token encryption key must be at least 32 bytes long.");
  }

  if (updates.CUSTOM_RECAPTCHA_SECRET_KEY) {
    const recaptchaSecret = updates.CUSTOM_RECAPTCHA_SECRET_KEY.trim();
    if (recaptchaSecret.length < 20) {
      throw validationError("The reCAPTCHA secret key looks too short. Check the key and try again.");
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const params = new URLSearchParams({
        secret: recaptchaSecret,
        response: "dnhs_probe_token",
      });
      const googleRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (googleRes.ok) {
        const result = await googleRes.json();
        const errorCodes = result["error-codes"] || [];
        if (errorCodes.includes("invalid-input-secret")) {
          throw validationError("Google reCAPTCHA rejected this Secret Key (invalid-input-secret). Verify your private secret key in Google reCAPTCHA admin console.");
        }
      }
    } catch (recaptchaError) {
      if (recaptchaError.statusCode === 400) throw recaptchaError;
      console.warn("reCAPTCHA verification network probe note:", recaptchaError.message);
    }
  }

  if (updates.CUSTOM_VITE_RECAPTCHA_SITE_KEY) {
    const siteKey = updates.CUSTOM_VITE_RECAPTCHA_SITE_KEY.trim();
    if (siteKey.length < 20) {
      throw validationError("The reCAPTCHA site key looks too short. Check the key and try again.");
    }
  }

  if (Object.hasOwn(updates, "CUSTOM_EMAIL_USER") || Object.hasOwn(updates, "CUSTOM_EMAIL_APP_PASSWORD")) {
    const user = updates.CUSTOM_EMAIL_USER ?? effectiveValue("CUSTOM_EMAIL_USER", "EMAIL_USER");
    const pass = updates.CUSTOM_EMAIL_APP_PASSWORD ?? effectiveValue("CUSTOM_EMAIL_APP_PASSWORD", "EMAIL_APP_PASSWORD");
    if (user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
      throw validationError("Enter a valid email address for the mailer account.");
    }
    if (user && pass) {
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
      try {
        await transporter.verify();
      } catch (mailError) {
        throw validationError(`The Gmail mailer could not sign in (${mailError.message || "Authentication failed"}). Check your Gmail address and 16-character App Password.`);
      }
    }
  }
}

// Public endpoint: exposes integration status only, never secret keys.
router.get("/public", async (req, res) => {
  try {
    const settings = await readSettings();
    return res.json({
      success: true,
      settings: {
        googleSignIn: settings.googleSignIn,
        recaptcha: settings.recaptcha,
        googleClientId: effectiveValue("CUSTOM_VITE_GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID") || effectiveValue("CUSTOM_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"),
        recaptchaSiteKey: effectiveValue("CUSTOM_VITE_RECAPTCHA_SITE_KEY", "VITE_RECAPTCHA_SITE_KEY"),
      },
    });
  } catch (error) {
    console.error("Public integration settings error:", error);
    return res.status(500).json({
      error: "Unable to load integration settings.",
    });
  }
});

const SECURITY_RECORD_LIFETIME_MS = 24 * 60 * 60 * 1000;
const SECURITY_CODE_LIFETIME_MS = 5 * 60 * 1000;

async function findConfiguredSuperUser() {
  const configuredEmail = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
  if (!configuredEmail) return null;
  return User.findOne({
    email: configuredEmail,
    role: "admin",
    status: "active",
  }).select("name email role status");
}

function normalizedCustomConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const normalized = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(CUSTOM_ENV_KEYS, key) || typeof value !== "string" || value.length > 4096) {
      return null;
    }
    normalized[key] = key === "CUSTOM_EMAIL_APP_PASSWORD"
      ? value.trim().replace(/\s+/g, "")
      : value.trim();
  }
  return Object.keys(normalized).length ? normalized : null;
}

function approvalRequest(body) {
  if (body?.action === "toggle-setting") {
    const payload = body.payload;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.keys(payload).length !== 2 ||
      !["googleSignIn", "recaptcha"].includes(payload.key) ||
      typeof payload.value !== "boolean"
    ) return null;
    return { action: "toggle-setting", payload: { key: payload.key, value: payload.value }, description: `${payload.key} setting` };
  }

  if (body?.action === "custom-config") {
    const payload = normalizedCustomConfig(body.payload);
    if (!payload) return null;
    return { action: "custom-config", payload, description: "custom integration credentials" };
  }

  if (body?.action === "configure-integration") {
    const target = typeof body.payload?.target === "string" ? body.payload.target.trim() : "";
    if (!["google", "recaptcha", "email", "token"].includes(target)) return null;
    const targetNames = {
      google: "Google OAuth credentials",
      recaptcha: "reCAPTCHA v3 keys",
      email: "Email mailer credentials",
      token: "Token signing secret",
    };
    return {
      action: "configure-integration",
      payload: { target },
      description: `access custom configuration for ${targetNames[target] || target}`,
    };
  }

  if (["google-connect", "google-disconnect"].includes(body?.action)) {
    if (body.payload && (typeof body.payload !== "object" || Array.isArray(body.payload) || Object.keys(body.payload).length)) {
      return null;
    }
    return {
      action: body.action,
      payload: {},
      description: body.action === "google-connect" ? "Google Drive connection" : "Google Drive disconnection",
    };
  }

  return null;
}

// All private endpoints require an active administrator.
router.use(requireAdmin);

router.post("/security/request-access", authRateLimits.integrationOtpRequestIp, async (req, res) => {
  try {
    const suppliedEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const configuredEmail = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
    if (!configuredEmail) {
      return res.status(503).json({ error: "Super-user access is not configured on this server." });
    }
    if (!suppliedEmail || suppliedEmail !== configuredEmail) {
      return res.status(403).json({ error: "The super-user email could not be verified." });
    }

    const superUser = await findConfiguredSuperUser();
    if (!superUser) {
      return res.status(503).json({ error: "The configured super-user must be an active administrator account." });
    }

    const code = String(crypto.randomInt(10000000, 100000000));
    const now = Date.now();
    const grant = await IntegrationSecurityGrant.create({
      adminId: req.authenticatedUser._id,
      superUserId: superUser._id,
      superUserEmail: superUser.email,
      purpose: "access-otp",
      codeHash: hashCode("pending", code),
      codeExpiresAt: new Date(now + SECURITY_CODE_LIFETIME_MS),
      expiresAt: new Date(now + SECURITY_RECORD_LIFETIME_MS),
    });
    grant.codeHash = hashCode(String(grant._id), code);
    await grant.save();

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
      return res.status(503).json({ error: "Unable to send the super-user verification code." });
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
      message: "A verification code was sent to the configured super user. It expires in 5 minutes.",
    });
  } catch (error) {
    console.error("Integration access code request error:", error);
    return res.status(500).json({ error: "Unable to request integration access." });
  }
});

router.post("/security/verify-access", authRateLimits.integrationOtpVerifyIp, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { challengeId, code } = req.body || {};
    if (!mongoose.isValidObjectId(challengeId) || typeof code !== "string" || !/^\d{8}$/.test(code)) {
      return res.status(400).json({ error: "Enter the 8-digit verification code." });
    }

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

    const accessToken = crypto.randomBytes(32).toString("hex");
    const session = await IntegrationSecurityGrant.create({
      adminId: grant.adminId,
      superUserId: grant.superUserId,
      superUserEmail: grant.superUserEmail,
      purpose: "access-session",
      accessTokenHash: hashValue(accessToken),
      expiresAt: grant.expiresAt,
    });

    await logAudit({
      req,
      action: "INTEGRATION_ACCESS_GRANTED",
      category: "system",
      target: { entityType: "IntegrationSecurity", entityId: String(session._id), name: "Admin integration access" },
      description: "Verified super-user code and granted temporary integration access.",
      details: { superUserId: String(grant.superUserId), expiresAt: grant.expiresAt },
    });

    res.set("Cache-Control", "no-store");
    return res.json({ success: true, accessToken, expiresAt: grant.expiresAt });
  } catch (error) {
    console.error("Integration access verification error:", error);
    return res.status(500).json({ error: "Unable to verify integration access." });
  }
});

router.post("/security/request-approval", authRateLimits.integrationApprovalIp, requireIntegrationAccess, async (req, res) => {
  try {
    const request = approvalRequest(req.body);
    if (!request) {
      return res.status(400).json({ error: "The integration change approval request is invalid." });
    }

    const superUser = await findConfiguredSuperUser();
    if (!superUser) {
      return res.status(503).json({ error: "The configured super-user must be an active administrator account." });
    }

    const pin = String(crypto.randomInt(10000000, 100000000));
    const now = Date.now();
    const grant = await IntegrationSecurityGrant.create({
      adminId: req.authenticatedUser._id,
      superUserId: superUser._id,
      superUserEmail: superUser.email,
      purpose: "change-approval",
      codeHash: hashCode("pending", pin),
      codeExpiresAt: new Date(now + SECURITY_CODE_LIFETIME_MS),
      action: request.action,
      payloadHash: hashPayload(request.payload),
      expiresAt: new Date(now + SECURITY_RECORD_LIFETIME_MS),
    });
    grant.codeHash = hashCode(String(grant._id), pin);
    await grant.save();

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
      return res.status(503).json({ error: "Unable to send the approval PIN to the super user." });
    }

    await logAudit({
      req,
      action: "INTEGRATION_CHANGE_APPROVAL_REQUESTED",
      category: "system",
      target: { entityType: "IntegrationSecurity", entityId: String(grant._id), name: request.description },
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
});

router.use(requireIntegrationAccess);

router.post("/security/verify-approval", async (req, res) => {
  try {
    const { action, payload } = req.body || {};
    if (action !== "configure-integration") {
      return res.status(400).json({ error: "Invalid approval action." });
    }

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
      target: { entityType: "IntegrationSecurity", name: `Unlocked ${payload?.target} configuration` },
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
});

router.get("/", async (req, res) => {
  try {
    return res.json({
      success: true,
      settings: await readSettings(),
      customConfig: getCustomConfigStatus(),
    });
  } catch (error) {
    console.error("Read integration settings error:", error);
    return res.status(500).json({
      error: "Unable to load integration settings.",
    });
  }
});

router.put("/custom-config", async (req, res) => {
  try {
    const updates = normalizedCustomConfig(req.body?.customConfig);
    if (!updates) {
      return res.status(400).json({ error: "Provide custom configuration values to save." });
    }

    if (Object.hasOwn(updates, "CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY")) {
      const currentKey = effectiveValue("CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY", "GOOGLE_TOKEN_ENCRYPTION_KEY");
      const newKey = updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY;

      if (currentKey && currentKey !== newKey) {
        const isReset = !newKey?.trim();
        const originalDefault = (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() || process.env.AUTH_TOKEN_SECRET?.trim() || "")
          .replace(/^["']|["']$/g, "").trim();
        const hasValidFallback = isReset && Buffer.byteLength(originalDefault) >= 32;

        if (!hasValidFallback) {
          const connectedCount = await GoogleIntegration.countDocuments();
          if (connectedCount) {
            throw validationError(
              isReset
                ? "Cannot remove the custom encryption key: no original default is configured and Google accounts are still connected. Disconnect all Google accounts first, or configure a GOOGLE_TOKEN_ENCRYPTION_KEY in the server environment."
                : "Disconnect all Google accounts before changing the token encryption key. Existing connections depend on the current key."
            );
          }
        }

        if (isReset && hasValidFallback && originalDefault !== currentKey) {
          const connectedCount = await GoogleIntegration.countDocuments();
          if (connectedCount) {
            throw validationError(
              "The original default encryption key differs from the current custom key. Existing Google tokens were encrypted with the custom key and would become unreadable. Disconnect all Google accounts before resetting."
            );
          }
        }
      }
    }

    await validateCustomValues(updates);

    const configToken = req.get("x-su-config-token");
    let authorized = false;

    if (configToken && /^[a-f0-9]{64}$/i.test(configToken)) {
      const updatedKeys = Object.keys(updates);
      const isGoogle = updatedKeys.some((k) => k.includes("GOOGLE"));
      const isRecaptcha = updatedKeys.some((k) => k.includes("RECAPTCHA"));
      const isEmail = updatedKeys.some((k) => k.includes("EMAIL"));
      const isToken = updatedKeys.some((k) => k.includes("AUTH_TOKEN") || k.includes("DATABASE"));
      const targetGroup = isGoogle ? "google" : isRecaptcha ? "recaptcha" : isEmail ? "email" : isToken ? "token" : null;

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
        return res.status(403).json({ error: "Super-user authorization required. Please click Configure and verify with the super-user PIN." });
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
        customOverridesEnabled: Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, Boolean(value)])),
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
    console.error("Update custom integration configuration error:", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: statusCode === 400 ? error.message : "Unable to save custom settings. Check server file permissions and try again.",
    });
  }
});

router.patch("/", async (req, res) => {
  try {
    const body = req.body || {};
    const allowedKeys = Object.keys(DEFAULTS);
    const suppliedKeys = Object.keys(body);

    if (
      suppliedKeys.length !== 1 ||
      !allowedKeys.includes(suppliedKeys[0])
    ) {
      return res.status(400).json({
        error: "Update exactly one supported integration setting.",
      });
    }

    const key = suppliedKeys[0];
    const value = body[key];

    if (key === "emailMailer") {
      return res.status(400).json({
        error: "The Email Mailer is permanently active for password recovery and cannot be toggled off.",
      });
    }

    if (typeof value !== "boolean") {
      return res.status(400).json({
        error: "Integration status must be true or false.",
      });
    }

    const previous = await readSettings();
    const approved = await consumeApproval(req, {
      action: "toggle-setting",
      payload: { key, value },
    });
    if (!approved) {
      return res.status(403).json({ error: "A valid, unused super-user PIN is required for this exact integration change." });
    }

    await IntegrationSetting.findOneAndUpdate(
      { key: "global" },
      {
        $set: {
          [key]: value,
          updatedBy: req.authenticatedUser._id,
        },
        $setOnInsert: {
          key: "global",
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
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
    return res.status(500).json({
      error: "Unable to save integration settings.",
    });
  }
});

module.exports = router;
