const CSV_HEADERS = [
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

function escapeCsv(value) {
  const val = value === null || value === undefined ? "" : String(value);
  return `"${val.replace(/"/g, '""')}"`;
}

/** Turns an array of audit log documents into a CSV string. */
function buildAuditLogCsv(logs) {
  const rows = logs.map((log) =>
    [
      new Date(log.createdAt).toISOString(),
      log.actor?.name || "System",
      log.actor?.email || "",
      log.actor?.role || "system",
      log.action,
      log.category,
      log.target?.name || "",
      log.description,
      log.ipAddress || "",
      log.status || "success",
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

module.exports = { buildAuditLogCsv };