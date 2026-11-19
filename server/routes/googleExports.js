const express = require("express");

const { requireAuthenticatedUser, requireAdmin } = require("../middleware/authorization");
const {
  validateDriveExport,
  validateSheetsExport,
} = require("../middleware/validators/googleExportValidation");
const controller = require("../controller/googleExportController");

const router = express.Router();

router.post("/drive", requireAuthenticatedUser, validateDriveExport, controller.saveToDrive);
router.post("/sheets", requireAdmin, validateSheetsExport, controller.exportToSheets);

module.exports = router;