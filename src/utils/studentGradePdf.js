const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatGrade(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "—";
}

function createReportPages({ rows, studentName, schoolYear, term }) {
  const pages = [];
  let ctx;
  let canvas;
  let y;
  const margin = 84;
  const contentWidth = PAGE_WIDTH - margin * 2;

  function startPage() {
    canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.fillStyle = "#123b79";
    ctx.fillRect(0, 0, PAGE_WIDTH, 300);
    ctx.fillStyle = "#bfdbfe";
    ctx.font = "600 24px Arial, sans-serif";
    ctx.fillText("DNHS-SGMS · STUDENT REPORT", margin, 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 52px Arial, sans-serif";
    ctx.fillText("Academic Progress Report", margin, 153);
    ctx.font = "400 26px Arial, sans-serif";
    ctx.fillStyle = "#dbeafe";
    ctx.fillText(cleanText(studentName) || "Student", margin, 211);
    ctx.font = "500 21px Arial, sans-serif";
    ctx.fillText([schoolYear && `School Year ${schoolYear}`, term && term !== "all" && term].filter(Boolean).join("  ·  ") || "All available terms", margin, 258);
    ctx.fillStyle = "#64748b";
    ctx.font = "400 18px Arial, sans-serif";
    ctx.fillText(`Generated ${new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date())}`, margin, PAGE_HEIGHT - 54);
    y = 350;
    pages.push(canvas);
  }

  function ensureSpace(height) {
    if (y + height > PAGE_HEIGHT - 96) startPage();
  }

  function wrapText(text, maxWidth, font) {
    ctx.font = font;
    const words = cleanText(text).split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
    return lines;
  }

  startPage();
  for (const entry of rows) {
    const periodEntry = entry.selectedPeriod;
    const grade = periodEntry?.grade;
    const finalized = Boolean(periodEntry?.isFinalized);
    const activities = periodEntry?.activities || [];
    ensureSpace(290);
    ctx.strokeStyle = "#dbe3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(PAGE_WIDTH - margin, y);
    ctx.stroke();

    const title = cleanText(entry.subject || "Subject");
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText(title.slice(0, 48), margin + 26, y + 45);
    const classRecord = entry.class || {};
    ctx.fillStyle = "#64748b";
    ctx.font = "400 19px Arial, sans-serif";
    ctx.fillText(`Grade ${classRecord.gradeLevel || "—"}  ·  Section ${cleanText(classRecord.section) || "—"}  ·  ${cleanText(entry.teacher?.name) || "Teacher unassigned"}`, margin + 26, y + 78);

    const status = finalized ? "FINALIZED" : grade ? "RUNNING" : "AWAITING SCORES";
    ctx.font = "700 17px Arial, sans-serif";
    const statusWidth = ctx.measureText(status).width + 30;
    ctx.fillStyle = finalized ? "#dcfce7" : grade ? "#fef3c7" : "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(PAGE_WIDTH - margin - statusWidth - 26, y + 20, statusWidth, 34, 17);
    ctx.fill();
    ctx.fillStyle = finalized ? "#166534" : grade ? "#92400e" : "#475569";
    ctx.fillText(status, PAGE_WIDTH - margin - statusWidth - 11, y + 43);
    y += 112;

    const categories = grade?.categories || {};
    const labels = Object.entries(CATEGORY_LABELS);
    const gap = 14;
    const boxWidth = (contentWidth - 52 - gap * 2) / 3;
    labels.forEach(([key, label], index) => {
      const x = margin + 26 + index * (boxWidth + gap);
      const category = categories[key];
      ctx.fillStyle = "#f1f5f9";
      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(x, y, boxWidth, 90, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "600 16px Arial, sans-serif";
      ctx.fillText(label.toUpperCase(), x + 14, y + 27);
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 25px Arial, sans-serif";
      ctx.fillText(category ? `${Number(category.percentage || 0).toFixed(1)}%` : "—", x + 14, y + 60);
      ctx.fillStyle = "#64748b";
      ctx.font = "400 14px Arial, sans-serif";
      ctx.fillText(category ? `${category.earned} / ${category.total} pts · ${category.weight}% weight` : "No scored work", x + 14, y + 80);
    });
    y += 116;

    ctx.fillStyle = finalized ? "#166534" : grade ? "#92400e" : "#475569";
    ctx.font = "700 21px Arial, sans-serif";
    ctx.fillText(finalized ? "Final grade" : "Current running grade", margin + 26, y + 5);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillText(grade ? `${formatGrade(grade.finalGrade)}${finalized ? "" : "*"}` : "Not available", margin + 26, y + 48);
    ctx.fillStyle = "#64748b";
    ctx.font = "400 17px Arial, sans-serif";
    const termLabel = periodEntry?.academicPeriod?.name || (term === "all" ? "Latest available period" : "No scores recorded for selected period");
    ctx.fillText(termLabel, margin + 270, y + 37);
    y += 88;

    if (activities.length) {
      ctx.fillStyle = "#334155";
      ctx.font = "700 18px Arial, sans-serif";
      ctx.fillText("SCORED ACTIVITIES", margin + 26, y);
      y += 28;
      activities.forEach((activity) => {
        const activityTitle = cleanText(activity.title) || "Activity";
        const titleLines = wrapText(activityTitle, contentWidth - 230, "500 17px Arial, sans-serif");
        const feedbackLines = activity.remarks ? wrapText(`Feedback: ${activity.remarks}`, contentWidth - 250, "400 14px Arial, sans-serif") : [];
        const rowHeight = Math.max(42, titleLines.length * 22 + feedbackLines.length * 18 + 12);
        ensureSpace(rowHeight);
        ctx.fillStyle = "#64748b";
        ctx.font = "500 14px Arial, sans-serif";
        ctx.fillText(CATEGORY_LABELS[activity.gradingCategory] || cleanText(activity.gradingCategory), margin + 28, y + 15);
        ctx.fillStyle = "#1e293b";
        ctx.font = "500 17px Arial, sans-serif";
        titleLines.forEach((line, index) => ctx.fillText(line, margin + 28, y + 37 + index * 22));
        feedbackLines.forEach((line, index) => {
          ctx.fillStyle = "#64748b";
          ctx.font = "400 14px Arial, sans-serif";
          ctx.fillText(line, margin + 28, y + 38 + titleLines.length * 22 + index * 18);
        });
        ctx.fillStyle = "#0f172a";
        ctx.font = "700 18px Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${activity.score} / ${activity.totalPoints}`, PAGE_WIDTH - margin - 28, y + 32);
        ctx.textAlign = "left";
        ctx.strokeStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.moveTo(margin + 26, y + rowHeight);
        ctx.lineTo(PAGE_WIDTH - margin - 26, y + rowHeight);
        ctx.stroke();
        y += rowHeight;
      });
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "italic 16px Arial, sans-serif";
      ctx.fillText("No scored activities recorded for this period.", margin + 26, y);
      y += 36;
    }
    y += 24;
  }
  return pages;
}

function encode(text) {
  return new TextEncoder().encode(text);
}

function joinBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => { joined.set(chunk, offset); offset += chunk.length; });
  return joined;
}

async function canvasToJpeg(canvas) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not render the report PDF.")), "image/jpeg", 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

async function buildPdf(pageCanvases) {
  const images = await Promise.all(pageCanvases.map(canvasToJpeg));
  const pageCount = images.length;
  const objectCount = 2 + pageCount * 3;
  const objects = new Array(objectCount + 1);
  const kids = [];
  objects[1] = encode("<< /Type /Catalog /Pages 2 0 R >>");
  for (let index = 0; index < pageCount; index += 1) {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    kids.push(`${pageObject} 0 R`);
    objects[pageObject] = encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    const image = images[index];
    objects[imageObject] = joinBytes([
      encode(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),
      image,
      encode("\nendstream"),
    ]);
    const stream = encode(`q ${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm /Im0 Do Q`);
    objects[contentObject] = encode(`<< /Length ${stream.length} >>\nstream\n${new TextDecoder().decode(stream)}\nendstream`);
  }
  objects[2] = encode(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>`);

  const chunks = [encode("%PDF-1.4\n")];
  const offsets = new Array(objectCount + 1).fill(0);
  let byteLength = chunks[0].length;
  for (let id = 1; id <= objectCount; id += 1) {
    const prefix = encode(`${id} 0 obj\n`);
    const suffix = encode("\nendobj\n");
    offsets[id] = byteLength;
    chunks.push(prefix, objects[id], suffix);
    byteLength += prefix.length + objects[id].length + suffix.length;
  }
  const xrefOffset = byteLength;
  const xref = [`xref\n0 ${objectCount + 1}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id <= objectCount; id += 1) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(encode(xref.join("") + trailer));
  return new Blob([joinBytes(chunks)], { type: "application/pdf" });
}

export async function downloadStudentGradePdf({ rows, studentName, schoolYear, term }) {
  if (!rows.length) throw new Error("There are no grades to export for this selection.");
  const pages = createReportPages({ rows, studentName, schoolYear, term });
  const pdf = await buildPdf(pages);
  const safeStudent = cleanText(studentName).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "student";
  const safeTerm = cleanText(term && term !== "all" ? term : schoolYear).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "grades";
  const url = URL.createObjectURL(pdf);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeStudent}-${safeTerm}-report-card.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
