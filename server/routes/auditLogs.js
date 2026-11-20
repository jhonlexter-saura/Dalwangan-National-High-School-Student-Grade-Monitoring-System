const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { parsePagination } = require("../middleware/parsePagination");
const {
  cloudExportsLimiter,
  searchFilterLimiter,
} = require("../middleware/rateLimits");
const { buildAuditLogFilter } = require("../middleware/validators/auditLogFilters");
const controller = require("../controller/auditLogController");

const router = express.Router();

router.get("/", requireAdmin, searchFilterLimiter, buildAuditLogFilter, parsePagination({ defaultLimit: 20, maxLimit: 100 }), controller.getAuditLogs);

// Must stay above "/:id", otherwise "export" would be treated as an id
router.get("/export", requireAdmin, cloudExportsLimiter, buildAuditLogFilter, controller.exportAuditLogs);

router.get("/:id", requireAdmin, searchFilterLimiter, controller.getAuditLogById);

module.exports = router;