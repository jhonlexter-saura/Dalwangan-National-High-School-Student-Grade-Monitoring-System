const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const IntegrationSetting = require("../models/IntegrationSetting");
const { requireAdmin } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");
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
  return process.env[customKey]?.trim() || process.env[defaultKey] || "";
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

  for (const key of ["CUSTOM_GOOGLE_CLIENT_ID", "CUSTOM_VITE_GOOGLE_CLIENT_ID"]) {
    const value = updates[key];
    if (value && !/^[^\s@]+\.apps\.googleusercontent\.com$/i.test(value)) {
      throw validationError("Enter a valid Google OAuth client ID ending in .apps.googleusercontent.com.");
    }
  }

  for (const key of ["CUSTOM_RECAPTCHA_SECRET_KEY", "CUSTOM_VITE_RECAPTCHA_SITE_KEY"]) {
    const value = updates[key];
    if (value && value.length < 20) {
      throw validationError("The reCAPTCHA key looks too short. Check the key and try again.");
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
      } catch {
        throw validationError("The mailer could not sign in with those credentials. Check the Gmail address and app password.");
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
