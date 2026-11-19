const AuditLog = require("../models/AuditLog");
const { backfillAuditLogsIfEmpty } = require("../services/auditLogger");
const { buildAuditLogCsv } = require("../services/auditLogExport");

const GRADEBOOK_ACTIONS = [
  "GRADEBOOK_FINALIZED",
  "GRADEBOOK_UNLOCKED",
  "CLASS_GRADEBOOK_FINALIZED",
  "CLASS_GRADEBOOK_UNLOCKED",
];

// GET /api/audit-logs - paginated, filtered list + summary stats
async function getAuditLogs(req, res) {
  try {
    await backfillAuditLogsIfEmpty();

    const query = req.auditFilter; // built by middleware
    const { page, limit, skip } = req.pagination; // parsed by middleware

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [logs, total, todayCount, gradesCount, gradebookCount, classesCount, totalAll] =
      await Promise.all([
        AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        AuditLog.countDocuments(query),
        AuditLog.countDocuments({ createdAt: { $gte: todayStart } }),
        AuditLog.countDocuments({ category: "grades" }),
        AuditLog.countDocuments({ action: { $in: GRADEBOOK_ACTIONS } }),
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
      stats: { todayCount, gradesCount, gradebookCount, classesCount, totalAll },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
}

// GET /api/audit-logs/export - CSV (or JSON with ?format=json)
async function exportAuditLogs(req, res) {
  try {
    const logs = await AuditLog.find(req.auditFilter)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    if (req.query.format === "json") {
      return res.json({ logs, exportedAt: new Date().toISOString() });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="DNHS-SGMS-Audit-Logs-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(buildAuditLogCsv(logs));
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return res.status(500).json({ error: "Failed to export audit logs" });
  }
}

// GET /api/audit-logs/:id - single record
async function getAuditLogById(req, res) {
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
}

module.exports = { getAuditLogs, exportAuditLogs, getAuditLogById };