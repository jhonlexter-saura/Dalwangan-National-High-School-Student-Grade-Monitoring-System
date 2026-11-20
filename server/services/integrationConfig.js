const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const IntegrationSetting = require("../models/IntegrationSetting");

const DEFAULTS = {
  googleSignIn: true,
  recaptcha: true,
  emailMailer: true,
};

async function readSettings() {
  const document = await IntegrationSetting.findOne({ key: "global" }).lean();

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

// Shared error response for the custom-config route (used by middleware and controller).
function respondCustomConfigError(res, error) {
  console.error("Update custom integration configuration error:", error.message);
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    error:
      statusCode === 400
        ? error.message
        : "Unable to save custom settings. Check server file permissions and try again.",
  });
}

// Validates custom credentials, including live probes against Mongo, Google and Gmail.
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
      throw validationError(
        "Could not connect using that database URI. Check the address, credentials, network access, and database access list."
      );
    } finally {
      if (probe) await probe.close().catch(() => {});
    }
  }

  if (
    updates.CUSTOM_AUTH_TOKEN_SECRET &&
    Buffer.byteLength(updates.CUSTOM_AUTH_TOKEN_SECRET) < 32
  ) {
    throw validationError("The custom token secret must be at least 32 bytes long.");
  }

  const googleClientId = updates.CUSTOM_GOOGLE_CLIENT_ID || updates.CUSTOM_VITE_GOOGLE_CLIENT_ID;
  if (googleClientId) {
    if (!/^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i.test(googleClientId)) {
      throw validationError(
        "Enter a valid Google OAuth Client ID ending in .apps.googleusercontent.com."
      );
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
        throw validationError(
          "Google returned an invalid reply: OAuth Client ID was not recognized by Google. Verify that the client ID is correct and active in Google Cloud Console."
        );
      }
    } catch (probeError) {
      if (probeError.statusCode === 400) throw probeError;
      console.warn("Google Client ID verification network probe note:", probeError.message);
    }
  }

  if (updates.CUSTOM_GOOGLE_CLIENT_SECRET && updates.CUSTOM_GOOGLE_CLIENT_SECRET.trim().length < 8) {
    throw validationError("The Google OAuth Client Secret looks too short.");
  }

  if (
    updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY &&
    Buffer.byteLength(updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY.trim()) < 32
  ) {
    throw validationError("The Google token encryption key must be at least 32 bytes long.");
  }

  if (
    Object.hasOwn(updates, "CUSTOM_RECAPTCHA_SECRET_KEY") ||
    Object.hasOwn(updates, "CUSTOM_VITE_RECAPTCHA_SITE_KEY")
  ) {
    const recaptchaSecret = (updates.CUSTOM_RECAPTCHA_SECRET_KEY || "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const recaptchaSiteKey = (updates.CUSTOM_VITE_RECAPTCHA_SITE_KEY || "")
      .trim()
      .replace(/^["']|["']$/g, "");

    // If both are empty, the admin is resetting/removing custom keys.
    if (!recaptchaSecret && !recaptchaSiteKey) {
      // Allowed reset
    } else {
      if (!recaptchaSiteKey) {
        throw validationError(
          "Both the reCAPTCHA site key and secret key are required to configure reCAPTCHA."
        );
      }
      if (!recaptchaSecret) {
        throw validationError(
          "Both the reCAPTCHA site key and secret key are required to configure reCAPTCHA."
        );
      }

      const KEY_FORMAT_REGEX = /^[A-Za-z0-9_-]{25,100}$/;
      if (!KEY_FORMAT_REGEX.test(recaptchaSiteKey)) {
        throw validationError(
          "Invalid reCAPTCHA site key format. Expected 30–60 letters, numbers, hyphens, or underscores."
        );
      }
      if (!KEY_FORMAT_REGEX.test(recaptchaSecret)) {
        throw validationError(
          "Invalid reCAPTCHA secret key format. Expected 30–60 letters, numbers, hyphens, or underscores."
        );
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
            throw validationError(
              "Google reCAPTCHA rejected this Secret Key (invalid-input-secret). Verify your private secret key in Google reCAPTCHA admin console."
            );
          }
        }
      } catch (recaptchaError) {
        if (recaptchaError.statusCode === 400) throw recaptchaError;
        console.warn("reCAPTCHA verification network probe note:", recaptchaError.message);
      }
    }
  }

  if (Object.hasOwn(updates, "CUSTOM_EMAIL_USER") || Object.hasOwn(updates, "CUSTOM_EMAIL_APP_PASSWORD")) {
    const user = updates.CUSTOM_EMAIL_USER ?? effectiveValue("CUSTOM_EMAIL_USER", "EMAIL_USER");
    const pass =
      updates.CUSTOM_EMAIL_APP_PASSWORD ??
      effectiveValue("CUSTOM_EMAIL_APP_PASSWORD", "EMAIL_APP_PASSWORD");
    if (user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
      throw validationError("Enter a valid email address for the mailer account.");
    }
    if (user && pass) {
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
      try {
        await transporter.verify();
      } catch (mailError) {
        throw validationError(
          `The Gmail mailer could not sign in (${mailError.message || "Authentication failed"}). Check your Gmail address and 16-character App Password.`
        );
      }
    }
  }
}

module.exports = {
  DEFAULTS,
  readSettings,
  effectiveValue,
  validationError,
  respondCustomConfigError,
  validateCustomValues,
};