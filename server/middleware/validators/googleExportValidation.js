const ALLOWED_DRIVE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** POST /drive -> req.driveExport */
function validateDriveExport(req, res, next) {
  const { fileName, mimeType, fileData, reportType, description, convertToGoogleSheet } =
    req.body || {};

  if (
    typeof fileName !== "string" ||
    !fileName.trim() ||
    typeof fileData !== "string" ||
    !fileData
  ) {
    return res.status(400).json({
      error: "Both fileName and fileData (base64) are required.",
    });
  }
  if (
    fileName.length > 180 ||
    /[\\/\0]/.test(fileName) ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(fileData) ||
    fileData.length > 10 * 1024 * 1024
  ) {
    return res
      .status(400)
      .json({ error: "The export file name or file data is invalid or too large." });
  }
  if (mimeType && !ALLOWED_DRIVE_MIME_TYPES.has(mimeType)) {
    return res
      .status(400)
      .json({ error: "Only PDF, XLSX, and CSV exports can be saved to Google Drive." });
  }
  if (convertToGoogleSheet && mimeType !== XLSX_MIME) {
    return res
      .status(400)
      .json({ error: "Only Excel workbooks can be converted to Google Sheets." });
  }

  req.driveExport = {
    fileName,
    mimeType,
    fileData,
    reportType,
    description,
    convertToGoogleSheet: Boolean(convertToGoogleSheet),
  };
  next();
}

/** POST /sheets -> req.sheetExport */
function validateSheetsExport(req, res, next) {
  const { title, sheetName, headers, rows, reportType } = req.body || {};

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 120 ||
    !Array.isArray(headers) ||
    !Array.isArray(rows) ||
    !headers.length ||
    headers.length > 40 ||
    rows.length > 10000 ||
    rows.some((row) => !Array.isArray(row) || row.length !== headers.length)
  ) {
    return res.status(400).json({
      error:
        "Provide a title, column headers, and rows with matching columns (up to 10,000 rows).",
    });
  }

  req.sheetExport = { title, sheetName, headers, rows, reportType };
  next();
}

module.exports = { validateDriveExport, validateSheetsExport };