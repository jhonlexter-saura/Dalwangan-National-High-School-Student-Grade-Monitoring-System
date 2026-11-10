const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const IntegrationSetting = require("../models/IntegrationSetting");
const { requireAdmin } = require("../middleware/authorization");
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
  const val = process.env[customKey]?.trim() || process.env[defaultKey]?.trim() || "";
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

// All management endpoints below require an active administrator.
router.use(requireAdmin);

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
    const supplied = req.body?.customConfig;
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) {
      return res.status(400).json({ error: "Provide custom configuration values to save." });
    }

    const updates = {};
    for (const [key, value] of Object.entries(supplied)) {
      if (!Object.hasOwn(CUSTOM_ENV_KEYS, key)) {
        return res.status(400).json({ error: `Unsupported custom setting: ${key}` });
      }
      if (typeof value !== "string" || value.length > 4096) {
        return res.status(400).json({ error: "Custom settings must be text values under 4,096 characters." });
      }
      updates[key] = key === "CUSTOM_EMAIL_APP_PASSWORD"
        ? value.trim().replace(/\s+/g, "")
        : value.trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No custom settings were provided." });
    }

    if (Object.hasOwn(updates, "CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY")) {
      const currentKey = effectiveValue("CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY", "GOOGLE_TOKEN_ENCRYPTION_KEY");
      if (currentKey && currentKey !== updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY) {
        const connectedCount = await GoogleIntegration.countDocuments();
        if (connectedCount) {
          throw validationError("Disconnect all Google accounts before changing or removing the token encryption key. Existing connections depend on the current key.");
        }
      }
    }

    await validateCustomValues(updates);
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
