const crypto = require("crypto");

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
};