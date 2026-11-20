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

  if (
    Object.hasOwn(updates, "CUSTOM_GOOGLE_CLIENT_ID") ||
    Object.hasOwn(updates, "CUSTOM_VITE_GOOGLE_CLIENT_ID") ||
    Object.hasOwn(updates, "CUSTOM_GOOGLE_CLIENT_SECRET") ||
    Object.hasOwn(updates, "CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY")
  ) {
    const googleClientId = (
      updates.CUSTOM_GOOGLE_CLIENT_ID ||
      updates.CUSTOM_VITE_GOOGLE_CLIENT_ID ||
      ""
    )
      .trim()
      .replace(/^["']|["']$/g, "");
    const googleClientSecret = (updates.CUSTOM_GOOGLE_CLIENT_SECRET || "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const googleTokenKey = (updates.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY || "")
      .trim()
      .replace(/^["']|["']$/g, "");

    // If all are empty, the admin is resetting/removing custom Google OAuth overrides
    if (!googleClientId && !googleClientSecret && !googleTokenKey) {
      // Allowed reset
    } else {
      if (!googleClientId || !googleClientSecret || !googleTokenKey) {
        throw validationError(
          "Google OAuth Client ID, Client Secret, and Token Encryption Key are all required to configure Google OAuth."
        );
      }

      if (!/^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i.test(googleClientId)) {
        throw validationError(
          "Enter a valid Google OAuth Client ID ending in .apps.googleusercontent.com."
        );
      }

      if (googleClientSecret.length < 16) {
        throw validationError(
          "Invalid Google OAuth Client Secret. Client secret must be at least 16 characters."
        );
      }

      if (Buffer.byteLength(googleTokenKey) < 32) {
        throw validationError("The Google token encryption key must be at least 32 bytes long.");
      }

      // Layer 3: Provider verification against Google Token Endpoint
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const params = new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          grant_type: "authorization_code",
          code: "dnhs_probe_authorization_code",
          redirect_uri:
            process.env.GOOGLE_REDIRECT_URI?.trim() ||
            "http://localhost:5000/api/v1/integrations/google/callback",
        });

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const tokenResult = await tokenRes.json().catch(() => ({}));
        if (tokenRes.status === 401 || tokenResult.error === "invalid_client") {
          throw validationError(
            "Google rejected the OAuth client credentials (invalid_client). Verify your Google Client ID and Client Secret in the Google Cloud Console."
          );
        }
      } catch (probeError) {
        if (probeError.statusCode === 400) throw probeError;
        console.warn(
          "Google OAuth credentials verification network probe note:",
          probeError.message
        );
      }
    }
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

  if (
    Object.hasOwn(updates, "CUSTOM_EMAIL_USER") ||
    Object.hasOwn(updates, "CUSTOM_EMAIL_APP_PASSWORD")
  ) {
    const rawUser = updates.CUSTOM_EMAIL_USER;
    const rawPass = updates.CUSTOM_EMAIL_APP_PASSWORD;

    const emailUser = typeof rawUser === "string" ? rawUser.trim().toLowerCase() : "";
    const emailPassword = typeof rawPass === "string" ? rawPass.trim().replace(/\s+/g, "") : "";

    // If both are empty, this is an allowed reset/removal of custom mailer overrides
    if (!emailUser && !emailPassword) {
      // Allowed reset
    } else {
      if (!emailUser || !emailPassword) {
        throw validationError(
          "Both the Gmail account and Gmail app password are required to configure the mailer."
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailUser)) {
        throw validationError("Enter a valid email address for the mailer account.");
      }

      if (!/^[a-zA-Z0-9]{16}$/.test(emailPassword)) {
        throw validationError(
          "Invalid Gmail app password format. Expected a 16-character Google App Password."
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: emailUser, pass: emailPassword },
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
        let msg = `The Gmail mailer could not sign in (${mailError.message || "Authentication failed"}). Check your Gmail address and 16-character App Password.`;
        if (
          mailError.responseCode === 535 ||
          String(mailError.message).includes("535") ||
          String(mailError.message).includes("Invalid login")
        ) {
          msg =
            "Google rejected the Gmail credentials (535 Invalid login). Please ensure 2-Step Verification is active on your Google account and use a generated 16-character App Password.";
        }
        throw validationError(msg);
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