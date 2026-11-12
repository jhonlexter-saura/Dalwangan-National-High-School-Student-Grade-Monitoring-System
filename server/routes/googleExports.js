const express = require("express");
const { requireAuthenticatedUser, requireAdmin } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");
const {
  uploadFileToDrive,
  createGoogleSheet,
} = require("../services/googleDriveService");

const router = express.Router();

// POST /drive - Save file (PDF, XLSX, CSV) to Google Drive
router.post("/drive", requireAuthenticatedUser, async (req, res) => {
  const { fileName, mimeType, fileData, reportType, description, convertToGoogleSheet } = req.body || {};

  const allowedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ]);
  if (typeof fileName !== "string" || !fileName.trim() || typeof fileData !== "string" || !fileData) {
    return res.status(400).json({
      error: "Both fileName and fileData (base64) are required.",
    });
  }
  if (fileName.length > 180 || /[\\/\0]/.test(fileName) || !/^[A-Za-z0-9+/]*={0,2}$/.test(fileData) || fileData.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: "The export file name or file data is invalid or too large." });
  }
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    return res.status(400).json({ error: "Only PDF, XLSX, and CSV exports can be saved to Google Drive." });
  }
  if (convertToGoogleSheet && mimeType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return res.status(400).json({ error: "Only Excel workbooks can be converted to Google Sheets." });
  }

  try {
    const fileBuffer = Buffer.from(fileData, "base64");
    if (!fileBuffer.length) return res.status(400).json({ error: "The export file is empty." });

    const result = await uploadFileToDrive({
      userId: req.authenticatedUser._id,
      fileName,
      mimeType: mimeType || "application/octet-stream",
      fileBuffer,
      description: description || `DNHS-SGMS ${reportType || "Export"}`,
      convertToGoogleSheet: Boolean(convertToGoogleSheet),
    });

    logAudit({
      req,
      action: "REPORT_SAVED_TO_GOOGLE_DRIVE",
      category: "system",
      target: { entityType: "GoogleDriveFile", entityId: result.fileId, name: result.name },
      description: `Saved report “${result.name}” to Google Drive`,
      details: {
        fileId: result.fileId,
        mimeType: result.mimeType,
        reportType: reportType || "general",
      },
    });

    return res.json({
      success: true,
      fileId: result.fileId,
      name: result.name,
      webViewLink: result.webViewLink,
      message: convertToGoogleSheet ? `“${result.name}” was saved as a Google Sheet.` : `“${result.name}” was saved to your Google Drive.`,
    });
  } catch (error) {
    console.error("Google Drive export error:", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to save file to Google Drive.",
    });
  }
});

// POST /sheets - Export tabular report to Google Sheets (Admin only)
router.post("/sheets", requireAdmin, async (req, res) => {
  const { title, sheetName, headers, rows, reportType } = req.body || {};

  if (typeof title !== "string" || !title.trim() || title.length > 120 || !Array.isArray(headers) || !Array.isArray(rows) || !headers.length || headers.length > 40 || rows.length > 10000 || rows.some((row) => !Array.isArray(row) || row.length !== headers.length)) {
    return res.status(400).json({
      error: "Provide a title, column headers, and rows with matching columns (up to 10,000 rows).",
    });
  }

  try {
    const result = await createGoogleSheet({
      userId: req.authenticatedUser._id,
      title: title || `DNHS-SGMS Export - ${new Date().toISOString().slice(0, 10)}`,
      sheetName: sheetName || "Audit Activity",
      headers: headers || [],
      rows: rows || [],
    });

    logAudit({
      req,
      action: "REPORT_EXPORTED_TO_GOOGLE_SHEETS",
      category: "system",
      target: { entityType: "GoogleSpreadsheet", entityId: result.spreadsheetId, name: result.title },
      description: `Exported “${result.title}” to Google Sheets`,
      details: {
        spreadsheetId: result.spreadsheetId,
        rowCount: (rows || []).length,
        reportType: reportType || "audit_logs",
      },
    });

    return res.json({
      success: true,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      title: result.title,
      message: `“${result.title}” exported to Google Sheets.`,
    });
  } catch (error) {
    console.error("Google Sheets export error:", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to export data to Google Sheets.",
    });
  }
});

module.exports = router;
