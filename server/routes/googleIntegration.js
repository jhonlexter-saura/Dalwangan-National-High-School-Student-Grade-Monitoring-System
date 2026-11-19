const express = require("express");

const { requireAuthenticatedUser } = require("../middleware/authorization");
const {
  requireIntegrationAccessForAdmins,
  sanitizeConnectReturnTo,
  validateOAuthCallback,
} = require("../middleware/googleIntegrationGuards");
const controller = require("../controller/googleIntegrationController");

const router = express.Router();

router.post("/connect", requireAuthenticatedUser, requireIntegrationAccessForAdmins, sanitizeConnectReturnTo, controller.connect);
router.get("/callback", validateOAuthCallback, controller.callback); // public: Google redirects the browser here
router.get("/status", requireAuthenticatedUser, controller.getStatus);
router.post("/disconnect", requireAuthenticatedUser, requireIntegrationAccessForAdmins, controller.disconnect);

module.exports = router;