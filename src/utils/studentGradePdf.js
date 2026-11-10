import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

function cleanText(value, fallback = "—") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}
function safeFilePart(value) {
  return cleanText(value, "report")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "") || "report";
}

function gradeText(periodEntry) {
  const value = periodEntry?.grade?.finalGrade;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(1)}${periodEntry.isFinalized ? "" : "*"}`;
}

function statusText(periodEntry) {
  if (periodEntry?.isFinalized) return "Finalized";
  if (periodEntry?.grade) return "In Progress";
  return "Awaiting scores";
}

function componentText(periodEntry) {
  const categories = periodEntry?.grade?.categories || {};
  return Object.entries(CATEGORY_LABELS)
    .map(([key, label]) => `${label}: ${categories[key] ? `${Number(categories[key].percentage || 0).toFixed(1)}%` : "—"}`)
    .join("\n");
}

function getMetadata({ studentName, schoolYear, term }) {
  return {
    studentName: cleanText(studentName, "Student"),
    schoolYear: schoolYear ? `School Year ${schoolYear}` : "All school years",
    term: term && term !== "all" ? term : "All terms",
    generated: new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date()),
  };
}

function drawPageHeader(doc, metadata) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(18, 59, 121);
  doc.rect(0, 0, pageWidth, 88, "F");
  doc.setTextColor(191, 219, 254);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DNHS-SGMS  ·  STUDENT REPORT", 36, 25);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.text("Academic Progress Report", 36, 49);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(219, 234, 254);
  doc.text(`${metadata.studentName}    ·    ${metadata.schoolYear}    ·    ${metadata.term}`, 36, 68, { maxWidth: pageWidth - 72 });
}

function addPageFooter(doc, generated) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(36, pageHeight - 31, pageWidth - 36, pageHeight - 31);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${generated}`, 36, pageHeight - 17);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 36, pageHeight - 17, { align: "right" });
  }
}

function buildActivityRows(rows) {
  return rows.flatMap((entry) => {
    const periodEntry = entry.selectedPeriod;
    const activities = periodEntry?.activities || [];
    if (!activities.length) {
      return [[
        cleanText(entry.subject, "Subject"),
        cleanText(periodEntry?.academicPeriod?.name, "Selected term"),
        "—",
        "No scored activities",
        "—",
        "—",
      ]];
    }
    return activities.map((activity) => [
      cleanText(entry.subject, "Subject"),
      cleanText(periodEntry?.academicPeriod?.name, "Selected term"),
      cleanText(activity.title, "Activity"),
      CATEGORY_LABELS[activity.gradingCategory] || cleanText(activity.gradingCategory),
      `${activity.score} / ${activity.totalPoints}`,
      cleanText(activity.remarks, "—"),
    ]);
  });
}

export function createStudentGradePdf({ rows, studentName, schoolYear, term }) {
  if (!rows.length) throw new Error("There are no grades to export for this selection.");

  const metadata = getMetadata({ studentName, schoolYear, term });
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  drawPageHeader(doc, metadata);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Subject summary", 36, 112);

  autoTable(doc, {
    startY: 122,
    margin: { top: 105, right: 36, bottom: 46, left: 36 },
    head: [["Subject / Class", "Teacher", "Component breakdown", "Grade", "Status"]],
    body: rows.map((entry) => {
      const classRecord = entry.class || {};
      const periodEntry = entry.selectedPeriod;
      const classMeta = `Grade ${cleanText(classRecord.gradeLevel)} · Section ${cleanText(classRecord.section)} · ${cleanText(classRecord.name)}`;
      return [
        `${cleanText(entry.subject, "Subject")}\n${classMeta}`,
        cleanText(entry.teacher?.name, "Unassigned"),
        componentText(periodEntry),
        `${gradeText(periodEntry)}${periodEntry?.grade && !periodEntry.isFinalized ? " (Running)" : ""}`,
        statusText(periodEntry),
      ];
    }),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 7, textColor: [51, 65, 85], lineColor: [226, 232, 240], overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: "bold", lineColor: [219, 234, 254] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 190 }, 1: { cellWidth: 115 }, 2: { cellWidth: 205 }, 3: { cellWidth: 95 }, 4: { cellWidth: 110 } },
    willDrawPage: () => drawPageHeader(doc, metadata),
  });

  const activityRows = buildActivityRows(rows);
  let activityHeadingY = (doc.lastAutoTable?.finalY || 122) + 27;
  if (activityHeadingY > doc.internal.pageSize.getHeight() - 90) {
    doc.addPage();
    drawPageHeader(doc, metadata);
    activityHeadingY = 112;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Scored activity details", 36, activityHeadingY);
  autoTable(doc, {
    startY: activityHeadingY + 10,
    margin: { top: 105, right: 36, bottom: 46, left: 36 },
    head: [["Subject", "Term", "Activity", "Component", "Score", "Teacher feedback"]],
    body: activityRows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 6, textColor: [51, 65, 85], lineColor: [226, 232, 240], overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: "bold", lineColor: [219, 234, 254] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 80 }, 2: { cellWidth: 150 }, 3: { cellWidth: 95 }, 4: { cellWidth: 65 }, 5: { cellWidth: "auto" } },
    willDrawPage: () => drawPageHeader(doc, metadata),
  });

  addPageFooter(doc, metadata.generated);
  return {
    doc,
    fileName: `${safeFilePart(metadata.studentName)}-${safeFilePart(term && term !== "all" ? term : schoolYear)}-report-card.pdf`,
  };
}

export function downloadStudentGradePdf(options) {
  const { doc, fileName } = createStudentGradePdf(options);
  doc.save(fileName);
}
