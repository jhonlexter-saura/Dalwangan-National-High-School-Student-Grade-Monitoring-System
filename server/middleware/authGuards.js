const { isAuthenticationConfigured } = require("./authorization");
const { getIntegrationFlags } = require("../services/integrationSettings");
const { verifyRecaptcha } = require("../services/recaptcha");
const { logFailedLogin } = require("../services/authAudit");

/** Stops every auth route early if the server has no auth secret configured. */
function requireAuthConfigured(req, res, next) {
  if (!isAuthenticationConfigured()) {
    return res.status(503).json({
      error: "Authentication is not configured on this server",
    });
  }
  next();
}

/** POST /login: verifies reCAPTCHA when the admin has it enabled. */
async function verifyLoginCaptcha(req, res, next) {
  try {
    const integrations = await getIntegrationFlags();

    if (integrations.recaptcha) {
      let captchaValid;

      try {
        captchaValid = await verifyRecaptcha(req.body?.captchaToken, req.ip);
      } catch (error) {
        if (error.message === "RECAPTCHA_NOT_CONFIGURED") {
          return res.status(503).json({
            error: "reCAPTCHA is not configured on this server",
          });
        }

        console.error("reCAPTCHA verification unavailable:", error.message);
        return res.status(503).json({
          error: "Unable to verify reCAPTCHA. Please try again.",
        });
      }

      if (!captchaValid) {
        await logFailedLogin(req, {
          identifier: typeof req.body?.email === "string" ? req.body.email : "",
          method: "password",
          reason: "captcha_failed",
        });
        return res.status(403).json({
          error: "reCAPTCHA verification failed. Please try again.",
        });
      }
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }

  next();
}

/** POST /google: checks the admin toggle and server config, exposes req.googleClientId. */
async function requireGoogleSignInEnabled(req, res, next) {
  try {
    const integrations = await getIntegrationFlags();

    if (!integrations.googleSignIn) {
      return res.status(403).json({
        error: "Google Sign-In is disabled by the administrator.",
      });
    }

    const clientId =
      process.env.CUSTOM_GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(503).json({
        error: "Google sign-in is not configured on this server",
      });
    }

    req.googleClientId = clientId;
  } catch (error) {
    console.error("Google sign-in error:", error.message);
    await logFailedLogin(req, { method: "Google", reason: "identity_verification_failed" });
    return res.status(401).json({
      error: "Google sign-in could not be verified. Please try again.",
    });
  }

  next();
}

module.exports = { requireAuthConfigured, verifyLoginCaptcha, requireGoogleSignInEnabled };