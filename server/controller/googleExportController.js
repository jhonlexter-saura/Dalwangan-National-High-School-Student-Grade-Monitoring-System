const { logAudit } = require("../services/auditLogger");
const {
  uploadFileToDrive,
  createGoogleSheet,
} = require("../services/googleDriveService");

// POST /drive - Save file (PDF, XLSX, CSV) to Google Drive
async function saveToDrive(req, res) {
  const { fileName, mimeType, fileData, reportType, description, convertToGoogleSheet } =
    req.driveExport; // validated by middleware

  try {
    const fileBuffer = Buffer.from(fileData, "base64");
    if (!fileBuffer.length) {
      return res.status(400).json({ error: "The export file is empty." });
    }

    const result = await uploadFileToDrive({
      userId: req.authenticatedUser._id,
      fileName,
      mimeType: mimeType || "application/octet-stream",
      fileBuffer,
      description: description || `DNHS-SGMS ${reportType || "Export"}`,
      convertToGoogleSheet,
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
      message: convertToGoogleSheet
        ? `“${result.name}” was saved as a Google Sheet.`
        : `“${result.name}” was saved to your Google Drive.`,
    });
  } catch (error) {
    console.error("Google Drive export error:", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to save file to Google Drive.",
    });
  }
}

// POST /sheets - Export tabular report to Google Sheets (Admin only)
async function exportToSheets(req, res) {
  const { title, sheetName, headers, rows, reportType } = req.sheetExport;

  try {
    const result = await createGoogleSheet({
      userId: req.authenticatedUser._id,
      title,
      sheetName: sheetName || "Audit Activity",
      headers,
      rows,
    });

    logAudit({
      req,
      action: "REPORT_EXPORTED_TO_GOOGLE_SHEETS",
      category: "system",
      target: { entityType: "GoogleSpreadsheet", entityId: result.spreadsheetId, name: result.title },
      description: `Exported “${result.title}” to Google Sheets`,
      details: {
        spreadsheetId: result.spreadsheetId,
        rowCount: rows.length,
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
}

module.exports = { saveToDrive, exportToSheets };