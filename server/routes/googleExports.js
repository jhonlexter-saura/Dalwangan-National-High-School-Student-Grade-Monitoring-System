const express = require("express");

const { requireAuthenticatedUser, requireAdmin } = require("../middleware/authorization");
const { cloudExportsLimiter } = require("../middleware/rateLimits");
const {
  validateDriveExport,
  validateSheetsExport,
} = require("../middleware/validators/googleExportValidation");
const controller = require("../controller/googleExportController");

const router = express.Router();

router.post("/drive", requireAuthenticatedUser, cloudExportsLimiter, validateDriveExport, controller.saveToDrive);
router.post("/sheets", requireAdmin, cloudExportsLimiter, validateSheetsExport, controller.exportToSheets);

module.exports = router;