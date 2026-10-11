const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const User = require("../models/User");
const {
  createAccessToken,
  isAuthenticationConfigured,
} = require("../middleware/authorization");
const { sendPasswordResetEmail } = require("../utils/mailer");

const router = express.Router();

const RESET_TOKEN_TTL_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 8;

// Password recovery is limited to these roles. Admin accounts are excluded.
const RECOVERY_ROLES = ["teacher", "student"];

// Same response whether or not the email exists, so the endpoint
// can't be used to find out which emails are registered.
const FORGOT_PASSWORD_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post("/login", async (req, res) => {
  try {
    if (!isAuthenticationConfigured()) {
      return res.status(503).json({
        error: "Authentication is not configured on this server",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: "This account is inactive.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const safeUser = user.toObject();

    delete safeUser.password;

    res.json({
      success: true,
      user: safeUser,
      token: createAccessToken(user._id),
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

// -----------------------------
// Password recovery
// -----------------------------

router.post("/forgot-password", async (req, res) => {
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

      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl: `${clientUrl}/reset-password/${token}`,
          expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
        });
      } catch (mailError) {
        // Email failed: invalidate the token and log the cause.
        // The response stays generic so existence isn't revealed.
        console.error("Password reset email error:", mailError);

        await User.updateOne(
          { _id: user._id },
          { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } }
        );
      }
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

router.post("/reset-password", async (req, res) => {
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