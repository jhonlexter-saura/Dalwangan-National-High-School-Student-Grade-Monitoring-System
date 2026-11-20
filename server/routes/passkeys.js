const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const {
  limits: authRateLimits,
  accountFailureGuard,
} = require("../middleware/authRateLimit");
const {
  requirePasskeyAuthConfigured,
  validatePasskeyId,
  validateRegistrationVerifyBody,
  validatePasskeyLoginOptionsBody,
  validatePasskeyLoginVerifyBody,
} = require("../middleware/validators/passkeyValidation");
const controller = require("../controller/passkeyController");

const router = express.Router();

// Managing passkeys (admin only)
router.post("/register/options", requireAdmin, controller.registerOptions);
router.post("/register/verify", requireAdmin, validateRegistrationVerifyBody, controller.registerVerify);
router.get("/", requireAdmin, controller.listPasskeys);
router.delete("/:id", requireAdmin, validatePasskeyId, controller.removePasskey);

// Signing in with a passkey (public, rate limited)
router.post(
  "/login/options",
  authRateLimits.passkeyOptionsIp,
  accountFailureGuard,
  requirePasskeyAuthConfigured,
  validatePasskeyLoginOptionsBody,
  controller.loginOptions
);
router.post(
  "/login/verify",
  authRateLimits.passkeyVerifyIp,
  validatePasskeyLoginVerifyBody,
  requirePasskeyAuthConfigured,
  controller.loginVerify
);

module.exports = router;