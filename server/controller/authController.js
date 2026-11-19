const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const IntegrationSecurityGrant = require("../models/IntegrationSecurityGrant");
const { createAccessToken } = require("../middleware/authorization");
const {
  recordFailedAccountLogin,
  clearAccountFailures,
} = require("../middleware/authRateLimit");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { logAudit } = require("../services/auditLogger");
const { logSuccessfulLogin, logFailedLogin } = require("../services/authAudit");

const googleClient = new OAuth2Client();

const RESET_TOKEN_TTL_MINUTES = 15;

// Password recovery is limited to these roles. Admin accounts are excluded.
const RECOVERY_ROLES = ["teacher", "student"];

// Same response whether or not the email exists, so the endpoint
// can't be used to find out which emails are registered.
const FORGOT_PASSWORD_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

/* ---------- helpers (used only by this controller) ---------- */

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeUser(user) {
  const result = user.toObject();

  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;

  return result;
}

// Duplicated in login and Google login.
async function clearAdminAccessGrants(user) {
  if (user.role === "admin") {
    await IntegrationSecurityGrant.deleteMany({
      adminId: user._id,
      purpose: "access-session",
    });
  }
}

/* ---------- handlers ---------- */

// POST /login  (config check, captcha, and body validation already done by middleware)
async function login(req, res) {
  try {
    const { email: normalizedEmail, password } = req.loginData;

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      recordFailedAccountLogin(normalizedEmail);
      await logFailedLogin(req, {
        identifier: normalizedEmail,
        method: "password",
        reason: "invalid_credentials",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status !== "active") {
      recordFailedAccountLogin(normalizedEmail);
      await logFailedLogin(req, {
        user,
        identifier: normalizedEmail,
        method: "password",
        reason: "invalid_credentials",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      recordFailedAccountLogin(normalizedEmail);
      await logFailedLogin(req, {
        user,
        identifier: normalizedEmail,
        method: "password",
        reason: "invalid_credentials",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await logSuccessfulLogin(req, user, "password");
    clearAccountFailures(normalizedEmail);
    await clearAdminAccessGrants(user);

    return res.json({
      success: true,
      user: safeUser(user),
      token: createAccessToken(user._id),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
}

// POST /google  (config check, enabled check, and credential validation done by middleware)
async function googleLogin(req, res) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.googleCredential,
      audience: req.googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || payload.email_verified !== true) {
      await logFailedLogin(req, {
        method: "Google",
        reason: "identity_verification_failed",
      });
      return res.status(401).json({ error: "Google account verification failed" });
    }

    const email = payload.email.trim().toLowerCase();

    // Google sign-in cannot create or assign an account or role.
    const user = await User.findOne({ email });

    if (!user) {
      await logFailedLogin(req, {
        identifier: email,
        method: "Google",
        reason: "account_not_found",
      });
      return res.status(401).json({
        error: "Google sign-in could not be verified. Please try again.",
      });
    }

    if (user.status !== "active") {
      await logFailedLogin(req, {
        user,
        identifier: email,
        method: "Google",
        reason: "account_inactive",
      });
      return res.status(401).json({
        error: "Google sign-in could not be verified. Please try again.",
      });
    }

    await logSuccessfulLogin(req, user, "Google");
    await clearAdminAccessGrants(user);

    return res.json({
      success: true,
      user: safeUser(user),
      token: createAccessToken(user._id),
    });
  } catch (error) {
    console.error("Google sign-in error:", error.message);
    await logFailedLogin(req, {
      method: "Google",
      reason: "identity_verification_failed",
    });

    return res.status(401).json({
      error: "Google sign-in could not be verified. Please try again.",
    });
  }
}

// POST /forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.forgotPasswordData;

    const user = await User.findOne({ email });

    const eligible =
      user && user.status === "active" && RECOVERY_ROLES.includes(user.role);

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
        target: {
          entityType: "User",
          entityId: String(user._id),
          name: user.name || user.email || "User",
        },
        description: resetEmailSent
          ? `Requested password recovery for '${user.name || user.email}'.`
          : `Password recovery email could not be sent for '${user.name || user.email}'.`,
        details: { role: user.role, method: "email_recovery" },
        status: resetEmailSent ? "success" : "failed",
      });
    }

    res.json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Unable to process the request" });
  }
}

// POST /reset-password
async function resetPassword(req, res) {
  try {
    const { token, password } = req.resetPasswordData;

    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
      status: "active",
      role: { $in: RECOVERY_ROLES },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
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
      target: {
        entityType: "User",
        entityId: String(user._id),
        name: user.name || user.email || "User",
      },
      description: `Reset password for '${user.name || user.email}' through email recovery.`,
      details: { role: user.role, method: "email_recovery" },
    });

    res.json({
      success: true,
      message: "Your password has been reset. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Unable to reset password" });
  }
}

module.exports = { login, googleLogin, forgotPassword, resetPassword };