const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const IntegrationSetting = require("../models/IntegrationSetting");

const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client();

const User = require("../models/User");
const IntegrationSecurityGrant = require("../models/IntegrationSecurityGrant");
const {
  createAccessToken,
  isAuthenticationConfigured,
} = require("../middleware/authorization");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { logAudit } = require("../services/auditLogger");
const {
  limits: authRateLimits,
  accountFailureGuard,
  recordFailedAccountLogin,
  clearAccountFailures,
  forgotPasswordAccountLimit,
} = require("../middleware/authRateLimit");

const router = express.Router();

const RESET_TOKEN_TTL_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 8;
const auditIdentifierSecret = process.env.CUSTOM_AUTH_TOKEN_SECRET?.trim()
  || process.env.AUTH_TOKEN_SECRET
  || crypto.randomBytes(32).toString("hex");

async function logSuccessfulLogin(req, user, method) {
  await logAudit({
    req,
    actor: {
      user: user._id,
      name: user.name || "User",
      email: user.email || "",
      role: user.role || "system",
    },
    action: "USER_LOGIN",
    category: "system",
    target: { entityType: "User", entityId: String(user._id), name: user.name || user.email || "User" },
    description: `${user.role || "User"} signed in using ${method}.`,
    details: { role: user.role, loginMethod: method },
  });
}

async function logFailedLogin(req, { user = null, identifier = "", method, reason }) {
  const identifierHash = identifier
    ? crypto.createHmac("sha256", auditIdentifierSecret).update(identifier.trim().toLowerCase()).digest("hex")
    : "";
  await logAudit({
    req,
    actor: user
      ? { user: user._id, name: user.name || "User", email: user.email || "", role: user.role || "system" }
      : { user: null, name: "Unrecognized sign-in", email: "", role: "system" },
    action: "USER_LOGIN",
    category: "system",
    target: user
      ? { entityType: "User", entityId: String(user._id), name: user.name || user.email || "User" }
      : { entityType: "AuthenticationAttempt", name: "Unrecognized account" },
    description: `Failed sign-in${user?.role ? ` for ${user.role}` : ""} using ${method}.`,
    details: { loginMethod: method, failureReason: reason, ...(identifierHash ? { attemptedIdentifierHash: identifierHash } : {}) },
    status: "failed",
  });
}

// Password recovery is limited to these roles. Admin accounts are excluded.
const RECOVERY_ROLES = ["teacher", "student"];

// Same response whether or not the email exists, so the endpoint
// can't be used to find out which emails are registered.
const FORGOT_PASSWORD_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getIntegrationFlags() {
  const settings = await IntegrationSetting.findOne({
    key: "global",
  }).lean();

  return {
    googleSignIn: settings?.googleSignIn ?? true,
    recaptcha: settings?.recaptcha ?? true,
  };
}

async function verifyRecaptcha(captchaToken, remoteIp) {
  const rawSecret = process.env.CUSTOM_RECAPTCHA_SECRET_KEY?.trim() || process.env.RECAPTCHA_SECRET_KEY;
  const recaptchaSecret = rawSecret ? rawSecret.replace(/^["']|["']$/g, "").trim() : "";
  if (!recaptchaSecret) {
    throw new Error("RECAPTCHA_NOT_CONFIGURED");
  }

  if (typeof captchaToken !== "string" || !captchaToken) {
    return false;
  }

  const params = new URLSearchParams({
    secret: recaptchaSecret,
    response: captchaToken,
  });

  if (remoteIp && remoteIp !== "127.0.0.1" && remoteIp !== "::1" && !remoteIp.startsWith("::ffff:127.")) {
    params.set("remoteip", remoteIp);
  }

  const response = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  if (!response.ok) {
    throw new Error("RECAPTCHA_VERIFICATION_UNAVAILABLE");
  }

  const result = await response.json();
  if (result.success !== true) {
    console.warn("reCAPTCHA verification returned false:", result["error-codes"]);
  }
  return result.success === true
    && result.action === "login"
    && typeof result.score === "number"
    && result.score >= 0.5;
}

router.post("/login", authRateLimits.passwordLoginIp, accountFailureGuard, async (req, res) => {
  try {
    if (!isAuthenticationConfigured()) {
      return res.status(503).json({
        error: "Authentication is not configured on this server",
      });
    }

    const integrations = await getIntegrationFlags();

    if (integrations.recaptcha) {
      let captchaValid;

      try {
        captchaValid = await verifyRecaptcha(
          req.body?.captchaToken,
          req.ip
        );
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

    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      recordFailedAccountLogin(normalizedEmail);
      await logFailedLogin(req, { identifier: normalizedEmail, method: "password", reason: "invalid_credentials" });
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      recordFailedAccountLogin(normalizedEmail);
      await logFailedLogin(req, { user, identifier: normalizedEmail, method: "password", reason: "invalid_credentials" });
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      recordFailedAccountLogin(normalizedEmail);
      await logFailedLogin(req, { user, identifier: normalizedEmail, method: "password", reason: "invalid_credentials" });
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    await logSuccessfulLogin(req, user, "password");
    clearAccountFailures(normalizedEmail);

    if (user.role === "admin") {
      await IntegrationSecurityGrant.deleteMany({ adminId: user._id, purpose: "access-session" });
    }

    return res.json({
      success: true,
      user: safeUser(user),
      token: createAccessToken(user._id),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Login failed",
    });
  }
});

function safeUser(user) {
  const result = user.toObject();

  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;

  return result;
}


router.post("/google", authRateLimits.googleLoginIp, async (req, res) => {
  try {
    if (!isAuthenticationConfigured()) {
      return res.status(503).json({
        error: "Authentication is not configured on this server",
      });
    }
    const integrations = await getIntegrationFlags();

    if (!integrations.googleSignIn) {
      return res.status(403).json({
        error: "Google Sign-In is disabled by the administrator.",
      });
    }

    const clientId = process.env.CUSTOM_GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(503).json({
        error: "Google sign-in is not configured on this server",
      });
    }

    const { credential } = req.body || {};

    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({
        error: "Google credential is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      await logFailedLogin(req, { method: "Google", reason: "identity_verification_failed" });
      return res.status(401).json({
        error: "Google account verification failed",
      });
    }

    const email = payload.email.trim().toLowerCase();

    // Google sign-in cannot create or assign an account or role.
    const user = await User.findOne({ email });

    if (!user) {
      await logFailedLogin(req, { identifier: email, method: "Google", reason: "account_not_found" });
      return res.status(401).json({
        error: "Google sign-in could not be verified. Please try again.",
      });
    }

    if (user.status !== "active") {
      await logFailedLogin(req, { user, identifier: email, method: "Google", reason: "account_inactive" });
      return res.status(401).json({
        error: "Google sign-in could not be verified. Please try again.",
      });
    }

    await logSuccessfulLogin(req, user, "Google");

    if (user.role === "admin") {
      await IntegrationSecurityGrant.deleteMany({ adminId: user._id, purpose: "access-session" });
    }

    return res.json({
      success: true,
      user: safeUser(user),
      token: createAccessToken(user._id),
    });
  } catch (error) {
    console.error("Google sign-in error:", error.message);
    await logFailedLogin(req, { method: "Google", reason: "identity_verification_failed" });

    return res.status(401).json({
      error: "Google sign-in could not be verified. Please try again.",
    });
  }
});


// -----------------------------
// Password recovery
// -----------------------------

router.post("/forgot-password", authRateLimits.forgotPasswordIp, forgotPasswordAccountLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    const eligible =
      user &&
      user.status === "active" &&
      RECOVERY_ROLES.includes(user.role);

    if (eligible) {
      // The plain token goes in the email; only its hash is stored.
      const token = crypto.randomBytes(32).toString("hex");

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            resetPasswordToken: hashToken(token),
            resetPasswordExpires: new Date(
              Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000
            ),
          },
        }
      );

      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      let resetEmailSent = true;

      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl: `${clientUrl}/reset-password/${token}`,
          expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
        });
      } catch (mailError) {
        resetEmailSent = false;
        // Email failed: invalidate the token and log the cause.
        // The response stays generic so existence isn't revealed.
        if (mailError.code !== "MAILER_DISABLED") {
          console.error("Password reset email error:", mailError);
        }

        await User.updateOne(
          { _id: user._id },
          { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } }
        );
      }

      await logAudit({
        req,
        actor: {
          user: user._id,
          name: user.name || "User",
          email: user.email || "",
          role: user.role || "system",
        },
        action: "PASSWORD_RESET_REQUESTED",
        category: "accounts",
        target: { entityType: "User", entityId: String(user._id), name: user.name || user.email || "User" },
        description: resetEmailSent
          ? `Requested password recovery for '${user.name || user.email}'.`
          : `Password recovery email could not be sent for '${user.name || user.email}'.`,
        details: { role: user.role, method: "email_recovery" },
        status: resetEmailSent ? "success" : "failed",
      });
    }

    res.json({
      success: true,
      message: FORGOT_PASSWORD_MESSAGE,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      error: "Unable to process the request",
    });
  }
});

router.post("/reset-password", authRateLimits.resetPasswordIp, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== "string" || !password) {
      return res.status(400).json({
        error: "Token and new password are required",
      });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
      status: "active",
      role: { $in: RECOVERY_ROLES },
    });

    if (!user) {
      return res.status(400).json({
        error: "This reset link is invalid or has expired.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Setting the new password and clearing the token in one update
    // makes each link single-use.
    await User.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
      }
    );

    await logAudit({
      req,
      actor: {
        user: user._id,
        name: user.name || "User",
        email: user.email || "",
        role: user.role || "system",
      },
      action: "PASSWORD_RESET",
      category: "accounts",
      target: { entityType: "User", entityId: String(user._id), name: user.name || user.email || "User" },
      description: `Reset password for '${user.name || user.email}' through email recovery.`,
      details: { role: user.role, method: "email_recovery" },
    });

    res.json({
      success: true,
      message: "Your password has been reset. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    res.status(500).json({
      error: "Unable to reset password",
    });
  }
});

module.exports = router;
