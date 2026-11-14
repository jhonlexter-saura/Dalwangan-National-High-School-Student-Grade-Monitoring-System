const express = require("express");
const AuditLog = require("../models/AuditLog");
const { requireAdmin } = require("../middleware/authorization");
const { backfillAuditLogsIfEmpty } = require("../services/auditLogger");

const router = express.Router();

// Helper to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// GET /api/audit-logs - Query audit logs with pagination & filtering
router.get("/", requireAdmin, async (req, res) => {
  try {
    // Check if we need to backfill historical events
    await backfillAuditLogsIfEmpty();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const {
      search,
      category,
      action,
      role,
      timeframe,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    // Category filter
    if (category && category !== "all") {
      query.category = category;
    }

    // Specific action filter
    if (action && action !== "all") {
      query.action = action;
    }

    // Role filter
    if (role && role !== "all") {
      query["actor.role"] = role;
    }

    // Timeframe / Date filters
    const now = new Date();
    if (timeframe === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query.createdAt = { $gte: startOfDay };
    } else if (timeframe === "week") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: sevenDaysAgo };
    } else if (timeframe === "month") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: thirtyDaysAgo };
    } else if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search query
    if (search && search.trim()) {
      const safeSearch = escapeRegex(search.trim());
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { description: regex },
        { "actor.name": regex },
        { "actor.email": regex },
        { "target.name": regex },
        { action: regex },
      ];
    }

    // Parallel fetch for logs, total count, and summary statistics
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [logs, total, todayCount, gradesCount, gradebookCount, classesCount, totalAll] =
      await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(query),
        AuditLog.countDocuments({ createdAt: { $gte: todayStart } }),
        AuditLog.countDocuments({ category: "grades" }),
        AuditLog.countDocuments({
          action: { $in: ["GRADEBOOK_FINALIZED", "GRADEBOOK_UNLOCKED", "CLASS_GRADEBOOK_FINALIZED", "CLASS_GRADEBOOK_UNLOCKED"] },
        }),
        AuditLog.countDocuments({ category: { $in: ["classes", "students"] } }),
        AuditLog.countDocuments({}),
      ]);

    return res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        todayCount,
        gradesCount,
        gradebookCount,
        classesCount,
        totalAll,
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return res.status(500).json({
      error: "Failed to fetch audit logs",
    });
  }
});

// GET /api/audit-logs/export - Export audit logs as CSV
router.get("/export", requireAdmin, async (req, res) => {
  try {
    const { category, action, role, timeframe, startDate, endDate, search } = req.query;
    const query = {};

    if (category && category !== "all") query.category = category;
    if (action && action !== "all") query.action = action;
    if (role && role !== "all") query["actor.role"] = role;

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");
      query.$or = [
        { description: regex },
        { "actor.name": regex },
        { "actor.email": regex },
        { "target.name": regex },
        { action: regex },
      ];
    }

    const now = new Date();
    if (timeframe === "today") {
      query.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    } else if (timeframe === "week") {
      query.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (timeframe === "month") {
      query.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    } else if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(10000).lean();

    const headers = [
      "Timestamp",
      "Actor Name",
      "Actor Email",
      "Actor Role",
      "Action",
      "Category",
      "Target Name",
      "Description",
      "IP Address",
      "Status",
    ];

    const escapeCsv = (str) => {
      const val = str === null || str === undefined ? "" : String(str);
      return `"${val.replace(/"/g, '""')}"`;
    };

    const rows = logs.map((log) => [
      escapeCsv(new Date(log.createdAt).toISOString()),
      escapeCsv(log.actor?.name || "System"),
      escapeCsv(log.actor?.email || ""),
      escapeCsv(log.actor?.role || "system"),
      escapeCsv(log.action),
      escapeCsv(log.category),
      escapeCsv(log.target?.name || ""),
      escapeCsv(log.description),
      escapeCsv(log.ipAddress || ""),
      escapeCsv(log.status || "success"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="DNHS-SGMS-Audit-Logs-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return res.status(500).json({ error: "Failed to export audit logs" });
  }
});

// GET /api/audit-logs/:id - Get single audit log record details
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) {
      return res.status(404).json({ error: "Audit record not found" });
    }
    return res.json(log);
  } catch (error) {
    console.error("Error fetching audit log detail:", error);
    return res.status(500).json({ error: "Failed to fetch audit record" });
  }
});

module.exports = router;
