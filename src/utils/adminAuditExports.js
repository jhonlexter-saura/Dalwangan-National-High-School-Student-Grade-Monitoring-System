import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function actorName(log) {
  return clean(log.actor?.name) || "System";
}

function auditRows(logs) {
  return logs.map((log) => [
    log.createdAt ? new Date(log.createdAt).toLocaleString() : "—",
    `${actorName(log)}\n${clean(log.actor?.role || "system")}`,
    clean(log.action),
    clean(log.category),
    clean(log.target?.name),
    clean(log.description),
    clean(log.status || "success"),
  ]);
}

function filenameDate() {
  return new Date().toISOString().slice(0, 10);
}

function decoratePdfPages(doc, description) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(30, pageHeight - 28, pageWidth - 30, pageHeight - 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(description, 30, pageHeight - 15, { maxWidth: pageWidth - 100 });
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 30, pageHeight - 15, { align: "right" });
  }
}

export function createAdminAuditPdf({ logs, filters = {} }) {
  if (!logs?.length) throw new Error("There are no audit records to export for these filters.");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const description = [filters.category && filters.category !== "all" ? `Category: ${filters.category}` : "All categories", filters.role && filters.role !== "all" ? `Role: ${filters.role}` : "All roles", filters.timeframe && filters.timeframe !== "all" ? `Time: ${filters.timeframe}` : "Any time", filters.search ? `Search: ${filters.search}` : ""].filter(Boolean).join("  ·  ");

  doc.setFillColor(18, 59, 121);
  doc.rect(0, 0, pageWidth, 77, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(191, 219, 254);
  doc.text("DNHS-SGMS  ·  ADMINISTRATION", 30, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Activity Monitor Export", 30, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(219, 234, 254);
  doc.text(`Generated ${new Date().toLocaleString()}  ·  ${logs.length.toLocaleString()} records`, 30, 65);

  autoTable(doc, {
    startY: 91,
    margin: { top: 88, right: 30, bottom: 40, left: 30 },
    head: [["Date and time", "Actor", "Action", "Category", "Target", "Description", "Status"]],
    body: auditRows(logs),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 5, textColor: [51, 65, 85], lineColor: [226, 232, 240], overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: "bold", lineColor: [219, 234, 254] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 98 }, 1: { cellWidth: 100 }, 2: { cellWidth: 100 }, 3: { cellWidth: 70 }, 4: { cellWidth: 100 }, 5: { cellWidth: "auto" }, 6: { cellWidth: 62 } },
    willDrawPage: () => {
      doc.setFillColor(18, 59, 121);
      doc.rect(0, 0, pageWidth, 77, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(191, 219, 254);
      doc.text("DNHS-SGMS  ·  ADMINISTRATION", 30, 24);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Activity Monitor Export", 30, 48);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(219, 234, 254);
      doc.text(`Generated ${new Date().toLocaleString()}  ·  ${logs.length.toLocaleString()} records`, 30, 65);
    },
  });

  decoratePdfPages(doc, description);
  return { blob: doc.output("blob"), fileName: `DNHS-SGMS-Audit-Logs-${filenameDate()}.pdf` };
}

export function downloadAdminAuditPdf(options) {
  const { blob, fileName } = createAdminAuditPdf(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createAdminAuditXlsx({ logs }) {
  if (!logs?.length) throw new Error("There are no audit records to export for these filters.");
  const rows = logs.map((log) => ({
    "Date and time": log.createdAt ? new Date(log.createdAt).toISOString() : "",
    Actor: actorName(log),
    "Actor email": clean(log.actor?.email),
    "Actor role": clean(log.actor?.role || "system"),
    Action: clean(log.action),
    Category: clean(log.category),
    Target: clean(log.target?.name),
    "Target type": clean(log.target?.entityType),
    Description: clean(log.description),
    "IP address": clean(log.ipAddress),
    Status: clean(log.status || "success"),
  }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 24 }, { wch: 26 }, { wch: 34 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 32 }, { wch: 22 }, { wch: 64 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Audit Activity");
  return {
    blob: new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName: `DNHS-SGMS-Audit-Logs-${filenameDate()}.xlsx`,
    rows,
  };
}

export function downloadAdminAuditXlsx(options) {
  const { blob, fileName } = createAdminAuditXlsx(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function adminAuditRowsForSheets(logs) {
  if (!logs?.length) throw new Error("There are no audit records to export for these filters.");
  return {
    headers: ["Date and time", "Actor", "Actor email", "Actor role", "Action", "Category", "Target", "Target type", "Description", "IP address", "Status"],
    rows: logs.map((log) => [
      log.createdAt ? new Date(log.createdAt).toISOString() : "",
      actorName(log), clean(log.actor?.email), clean(log.actor?.role || "system"),
      clean(log.action), clean(log.category), clean(log.target?.name),
      clean(log.target?.entityType), clean(log.description), clean(log.ipAddress),
      clean(log.status || "success"),
    ]),
  };
}
