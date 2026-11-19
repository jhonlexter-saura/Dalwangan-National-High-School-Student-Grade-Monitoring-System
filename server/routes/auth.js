const express = require("express");

const {
  limits: authRateLimits,
  accountFailureGuard,
  forgotPasswordAccountLimit,
} = require("../middleware/authRateLimit");
const {
  requireAuthConfigured,
  verifyLoginCaptcha,
  requireGoogleSignInEnabled,
} = require("../middleware/authGuards");
const {
  validateLoginBody,
  validateGoogleBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
} = require("../middleware/validators/authValidation");
const controller = require("../controller/authController");

const router = express.Router();

// Order matters on these chains: rate limit -> config/captcha guards -> body validation -> controller.
router.post(
  "/login",
  authRateLimits.passwordLoginIp,
  accountFailureGuard,
  requireAuthConfigured,
  verifyLoginCaptcha,
  validateLoginBody,
  controller.login
);

router.post(
  "/google",
  authRateLimits.googleLoginIp,
  requireAuthConfigured,
  requireGoogleSignInEnabled,
  validateGoogleBody,
  controller.googleLogin
);

// Password recovery
router.post(
  "/forgot-password",
  authRateLimits.forgotPasswordIp,
  forgotPasswordAccountLimit,
  validateForgotPasswordBody,
  controller.forgotPassword
);

router.post(
  "/reset-password",
  authRateLimits.resetPasswordIp,
  validateResetPasswordBody,
  controller.resetPassword
);

module.exports = router;