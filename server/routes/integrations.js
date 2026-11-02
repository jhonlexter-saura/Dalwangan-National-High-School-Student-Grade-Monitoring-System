const express = require("express");
const IntegrationSetting = require("../models/IntegrationSetting");
const { requireAdmin } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");

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

// Public endpoint: exposes integration status only, never secret keys.
router.get("/public", async (req, res) => {
  try {
    const settings = await readSettings();
    return res.json({
      success: true,
      settings: {
        googleSignIn: settings.googleSignIn,
        recaptcha: settings.recaptcha,
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
    });
  } catch (error) {
    console.error("Read integration settings error:", error);
    return res.status(500).json({
      error: "Unable to load integration settings.",
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
