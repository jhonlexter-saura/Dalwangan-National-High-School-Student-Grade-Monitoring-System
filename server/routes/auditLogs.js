const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { parsePagination } = require("../middleware/parsePagination");
const { buildAuditLogFilter } = require("../middleware/validators/auditLogFilters");
const controller = require("../controller/auditLogController");

const router = express.Router();

router.get("/", requireAdmin, buildAuditLogFilter, parsePagination({ defaultLimit: 20, maxLimit: 100 }), controller.getAuditLogs);

// Must stay above "/:id", otherwise "export" would be treated as an id
router.get("/export", requireAdmin, buildAuditLogFilter, controller.exportAuditLogs);

router.get("/:id", requireAdmin, controller.getAuditLogById);

module.exports = router;