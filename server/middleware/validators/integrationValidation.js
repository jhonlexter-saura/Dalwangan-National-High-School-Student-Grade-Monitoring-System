const mongoose = require("mongoose");
const GoogleIntegration = require("../../models/GoogleIntegration");
const { CUSTOM_ENV_KEYS } = require("../../services/customConfiguration");
const {
  DEFAULTS,
  effectiveValue,
  validationError,
  respondCustomConfigError,
  validateCustomValues,
} = require("../../services/integrationConfig");

/* ---------- pure helpers (logic unchanged) ---------- */

function normalizedCustomConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const normalized = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(CUSTOM_ENV_KEYS, key) || typeof value !== "string" || value.length > 4096) {
      return null;
    }
    normalized[key] =
      key === "CUSTOM_EMAIL_APP_PASSWORD" ? value.trim().replace(/\s+/g, "") : value.trim();
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
    ) {
      return null;
    }
    return {
      action: "toggle-setting",
      payload: { key: payload.key, value: payload.value },
      description: `${payload.key} setting`,
    };
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
    if (
      body.payload &&
      (typeof body.payload !== "object" ||
        Array.isArray(body.payload) ||
        Object.keys(body.payload).length)
    ) {
      return null;
    }
    return {
      action: body.action,
      payload: {},
      description:
        body.action === "google-connect" ? "Google Drive connection" : "Google Drive disconnection",
    };
  }

  return null;
}

/* ---------- security routes ---------- */

/** POST /security/verify-access -> req.verifyAccess = { challengeId, code } */
function validateVerifyAccessBody(req, res, next) {
  res.set("Cache-Control", "no-store");
  const { challengeId, code } = req.body || {};
  if (
    !mongoose.isValidObjectId(challengeId) ||
    typeof code !== "string" ||
    !/^\d{8}$/.test(code)
  ) {
    return res.status(400).json({ error: "Enter the 8-digit verification code." });
  }
  req.verifyAccess = { challengeId, code };
  next();
}

/** POST /security/request-approval -> req.approvalRequest */
function validateApprovalRequest(req, res, next) {
  const request = approvalRequest(req.body);
  if (!request) {
    return res
      .status(400)
      .json({ error: "The integration change approval request is invalid." });
  }
  req.approvalRequest = request;
  next();
}

/** POST /security/verify-approval -> req.approvalVerification = { action, payload } */
function validateVerifyApprovalBody(req, res, next) {
  const { action, payload } = req.body || {};
  if (action !== "configure-integration") {
    return res.status(400).json({ error: "Invalid approval action." });
  }
  req.approvalVerification = { action, payload };
  next();
}

/* ---------- PUT /custom-config: three steps, in the original order ---------- */

// Step 1: shape -> req.customConfigUpdates
function validateCustomConfigBody(req, res, next) {
  const updates = normalizedCustomConfig(req.body?.customConfig);
  if (!updates) {
    return res.status(400).json({ error: "Provide custom configuration values to save." });
  }
  req.customConfigUpdates = updates;
  next();
}

// Step 2: don't let the encryption key change while Google accounts depend on it
async function guardEncryptionKeyChange(req, res, next) {
  try {
    const updates = req.customConfigUpdates;

    if (Object.hasOwn(updates, "CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY")) {
      const currentKey = effectiveValue(
        "CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY",
        "GOOGLE_TOKEN_ENCRYPTION_KEY"
      );
      const newKey = updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY;

      if (currentKey && currentKey !== newKey) {
        const isReset = !newKey?.trim();
        const originalDefault = (
          process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
          process.env.AUTH_TOKEN_SECRET?.trim() ||
          ""
        )
          .replace(/^["']|["']$/g, "")
          .trim();
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
  } catch (error) {
    return respondCustomConfigError(res, error);
  }
  next();
}

// Step 3: validate the values themselves (includes live checks against Mongo, Google, Gmail)
async function validateCustomConfigValues(req, res, next) {
  try {
    await validateCustomValues(req.customConfigUpdates);
  } catch (error) {
    return respondCustomConfigError(res, error);
  }
  next();
}

/* ---------- PATCH / ---------- */

/** -> req.settingToggle = { key, value } */
function validateSettingToggle(req, res, next) {
  const body = req.body || {};
  const allowedKeys = Object.keys(DEFAULTS);
  const suppliedKeys = Object.keys(body);

  if (suppliedKeys.length !== 1 || !allowedKeys.includes(suppliedKeys[0])) {
    return res.status(400).json({ error: "Update exactly one supported integration setting." });
  }

  const key = suppliedKeys[0];
  const value = body[key];

  if (key === "emailMailer") {
    return res.status(400).json({
      error: "The Email Mailer is permanently active for password recovery and cannot be toggled off.",
    });
  }
  if (typeof value !== "boolean") {
    return res.status(400).json({ error: "Integration status must be true or false." });
  }

  req.settingToggle = { key, value };
  next();
}

module.exports = {
  validateVerifyAccessBody,
  validateApprovalRequest,
  validateVerifyApprovalBody,
  validateCustomConfigBody,
  guardEncryptionKeyChange,
  validateCustomConfigValues,
  validateSettingToggle,
};