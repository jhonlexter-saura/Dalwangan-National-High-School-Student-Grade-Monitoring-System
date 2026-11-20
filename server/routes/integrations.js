const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { requireIntegrationAccess } = require("../middleware/integrationSecurity");
const { limits: authRateLimits } = require("../middleware/authRateLimit");
const {
  validateVerifyAccessBody,
  validateApprovalRequest,
  validateVerifyApprovalBody,
  validateCustomConfigBody,
  guardEncryptionKeyChange,
  validateCustomConfigValues,
  validateSettingToggle,
} = require("../middleware/validators/integrationValidation");
const controller = require("../controller/integrationController");

const router = express.Router();

// Public: exposes integration status only, never secret keys.
router.get("/public", controller.getPublicSettings);

// Everything below requires an active administrator.
router.use(requireAdmin);

router.post("/security/request-access", authRateLimits.integrationOtpRequestIp, controller.requestAccess);
router.post("/security/verify-access", authRateLimits.integrationOtpVerifyIp, validateVerifyAccessBody, controller.verifyAccess);
router.post("/security/revoke-access", controller.revokeAccess);
router.post("/security/request-approval", authRateLimits.integrationApprovalIp, requireIntegrationAccess, validateApprovalRequest, controller.requestApproval);

// Everything below also requires a verified integration-access session.
router.use(requireIntegrationAccess);

router.post("/security/verify-approval", validateVerifyApprovalBody, controller.verifyApproval);
router.post("/test-recaptcha", authRateLimits.integrationApprovalIp, controller.testRecaptchaCredentials);
router.post("/test-mailer", authRateLimits.integrationApprovalIp, controller.testMailerCredentials);
router.post("/test-google", authRateLimits.integrationApprovalIp, controller.testGoogleCredentials);
router.get("/", controller.getSettings);
router.put("/custom-config", validateCustomConfigBody, guardEncryptionKeyChange, validateCustomConfigValues, controller.updateCustomConfig);
router.patch("/", validateSettingToggle, controller.updateSetting);

module.exports = router;