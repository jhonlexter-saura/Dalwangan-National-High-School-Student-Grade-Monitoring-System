import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getGoogleConnectUrl, getGoogleIntegrationStatus, getMyGrades, saveReportToGoogleDrive } from "../../services/schoolDataService";
import { createStudentGradePdf } from "../../utils/studentGradePdf";
import { blobToBase64, downloadBlob } from "../../utils/googleFileData";

const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "";
}

function formatGrade(value) {
  const grade = Number(value);
  return Number.isFinite(grade) ? grade.toFixed(1) : "—";
}

export default function StudentGrades() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const assignmentFilter = searchParams.get("assignmentId") || "";
  const [gradeData, setGradeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [expandedSubject, setExpandedSubject] = useState("");
  const [exportingFormat, setExportingFormat] = useState("");
  const [googleStatus, setGoogleStatus] = useState({ available: false, connected: false, email: "" });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getMyGrades();
        if (!active) return;
        setGradeData(data);
        const activePeriod = data.flatMap((entry) => entry.periods || []).find((period) => period.academicPeriod?.status === "active");
        if (activePeriod) {
          setSelectedSchoolYear(String(activePeriod.academicPeriod.schoolYear));
          setSelectedTerm(activePeriod.academicPeriod.name);
        } else if (data.length) {
          const latestPeriod = data.flatMap((entry) => entry.periods || []).sort((a, b) => String(b.academicPeriod?.schoolYear).localeCompare(String(a.academicPeriod?.schoolYear)) || Number(b.academicPeriod?.trimester || 0) - Number(a.academicPeriod?.trimester || 0))[0];
          if (latestPeriod) {
            setSelectedSchoolYear(String(latestPeriod.academicPeriod.schoolYear));
            setSelectedTerm(latestPeriod.academicPeriod.name);
          } else {
            setSelectedSchoolYear(String(data[0]?.class?.schoolYear || ""));
          }
        }
      } catch (error) {
        if (active) showToast(error.message || "Failed to load grades.", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (user) load();
    return () => { active = false; };
  }, [user, showToast]);

  useEffect(() => {
    const refreshStatus = () => { getGoogleIntegrationStatus().then(setGoogleStatus).catch(() => {}); };
    refreshStatus();
    window.addEventListener("pageshow", refreshStatus);
    window.addEventListener("focus", refreshStatus);

    const callbackUrl = new URL(window.location.href);
    const connected = callbackUrl.searchParams.get("google_connected");
    const callbackError = callbackUrl.searchParams.get("google_error");
    if (connected === "true") {
      showToast("Google Drive connected successfully.", "success");
      refreshStatus();
    } else if (callbackError) {
      showToast(`Google connection failed: ${callbackError}`, "error");
    }
    if (connected || callbackError) {
      callbackUrl.searchParams.delete("google_connected");
      callbackUrl.searchParams.delete("google_error");
      window.history.replaceState({}, "", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
    }

    return () => {
      window.removeEventListener("pageshow", refreshStatus);
      window.removeEventListener("focus", refreshStatus);
    };
  }, [showToast]);

  const visibleGradeData = assignmentFilter
    ? gradeData.filter((entry) => String(entry.subjectAssignment?._id) === assignmentFilter)
    : gradeData;
  const schoolYears = [...new Set(visibleGradeData.map((entry) => String(entry.class?.schoolYear || "")).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const availablePeriods = useMemo(() => {
    const all = visibleGradeData.flatMap((entry) => entry.periods || []);
    const unique = new Map(all.map((period) => [String(period.academicPeriod._id), period.academicPeriod]));
    return [...unique.values()]
      .filter((period) => !selectedSchoolYear || String(period.schoolYear) === selectedSchoolYear)
      .sort((a, b) => Number(a.trimester || 0) - Number(b.trimester || 0));
  }, [visibleGradeData, selectedSchoolYear]);

  if (loading) return <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  const rows = visibleGradeData
    .filter((entry) => !selectedSchoolYear || String(entry.class?.schoolYear) === selectedSchoolYear)
    .map((entry) => {
      const periods = entry.periods || [];
      const selectedPeriod = selectedTerm === "all"
        ? [...periods].sort((a, b) => Number(b.academicPeriod?.trimester || 0) - Number(a.academicPeriod?.trimester || 0))[0]
        : periods.find((period) => period.academicPeriod?.name === selectedTerm);
      return { ...entry, selectedPeriod };
    });

  async function handleExport(format) {
    try {
      setExportingFormat(format);
      const exportData = { rows, studentName: user?.name, schoolYear: selectedSchoolYear, term: selectedTerm };
      const { doc, fileName } = createStudentGradePdf(exportData);
      downloadBlob(doc.output("blob"), fileName);
      showToast("Your report card PDF has been downloaded.", "success");
    } catch (error) {
      showToast(error.message || "Unable to export the report card.", "error");
    } finally {
      setExportingFormat("");
    }
  }

  async function handleGoogleDrive() {
    try {
      setExportingFormat("drive");
      if (!googleStatus.connected) {
        if (!googleStatus.available) throw new Error("Google Drive is not configured yet. Please contact your administrator.");
        const { authUrl } = await getGoogleConnectUrl("/student/grades");
        window.location.assign(authUrl);
        return;
      }
      const { doc, fileName } = createStudentGradePdf({ rows, studentName: user?.name, schoolYear: selectedSchoolYear, term: selectedTerm });
      const result = await saveReportToGoogleDrive({
        fileName,
        mimeType: "application/pdf",
        fileData: await blobToBase64(doc.output("blob")),
        reportType: "student_report_card",
        description: `Report card for ${user?.name || "student"}`,
      });
      showToast(result.message || "Report card saved to Google Drive.", "success");
    } catch (error) {
      showToast(error.message || "Unable to save the report card to Google Drive.", "error");
    } finally {
      setExportingFormat("");
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-3"><GraduationCap className="h-6 w-6 text-blue-600" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{assignmentFilter ? `${visibleGradeData[0]?.subject || "Subject"} Grades` : "My Grades"}</h1>
          <p className="text-sm text-gray-500">{assignmentFilter ? "Review your scores and grade breakdown for this subject." : "View your current running scores and finalized grades."}</p>
        </div>
        {assignmentFilter && <Link to="/student/grades" className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all subjects</Link>}
      </header>

      {visibleGradeData.length > 0 && <section className="flex min-w-0 flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="w-full text-sm font-medium text-gray-700 sm:w-64">School Year
            <select value={selectedSchoolYear} onChange={(event) => { setSelectedSchoolYear(event.target.value); setSelectedTerm("all"); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              {schoolYears.map((year) => <option key={year} value={year}>School Year {year}</option>)}
            </select>
          </label>
          <label className="w-full text-sm font-medium text-gray-700 sm:w-64">Term
            <select value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="all">All Terms</option>
              {availablePeriods.map((period) => <option key={period._id || period.name} value={period.name}>{period.name}{period.status === "active" ? " · Active" : ""}</option>)}
            </select>
          </label>
        </div>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
          <button type="button" onClick={() => handleExport("pdf")} disabled={Boolean(exportingFormat) || !rows.length} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"><Download size={16} /> {exportingFormat === "pdf" ? "Preparing PDF…" : "Download Report Card PDF"}</button>
          {googleStatus.available && <button type="button" onClick={handleGoogleDrive} disabled={Boolean(exportingFormat) || !rows.length} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"><Cloud size={16} /> {exportingFormat === "drive" ? "Saving…" : googleStatus.connected ? "Save PDF to Google Drive" : "Connect Google Drive"}</button>}
        </div>
      </section>}

      {gradeData.length === 0 && !assignmentFilter && <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
        <GraduationCap className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-4 font-semibold text-gray-700">You are not enrolled in any class yet</h2>
        <p className="mt-1 text-sm text-gray-500">Your grades will appear here once you are added to a class.</p>
      </div>}

      {assignmentFilter && visibleGradeData.length === 0 && gradeData.length > 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">No grade records are available for this subject yet.</div>}

      {rows.length > 0 && <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-bold text-gray-800">Subject grades</h2><p className="mt-0.5 text-sm text-gray-500">Running scores show graded activities only and may change before finalization.</p></div>
        <div className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1140px] table-fixed border-collapse text-left">
            <colgroup><col className="w-[250px]" /><col className="w-[145px]" /><col className="w-[300px]" /><col className="w-[145px]" /><col className="w-[150px]" /><col className="w-[150px]" /></colgroup>
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Subject</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3 text-center">Component breakdown</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3"><span className="sr-only">Details</span></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((entry) => {
                const assignmentId = String(entry.subjectAssignment?._id || entry.class?._id);
                const periodEntry = entry.selectedPeriod;
                const grade = periodEntry?.grade;
                const finalized = Boolean(periodEntry?.isFinalized);
                const expanded = expandedSubject === assignmentId;
                const categories = grade?.categories || {};
                return <FragmentRow key={assignmentId} entry={entry} periodEntry={periodEntry} grade={grade} finalized={finalized} expanded={expanded} onToggle={() => setExpandedSubject(expanded ? "" : assignmentId)} categories={categories} />;
              })}
            </tbody>
          </table>
        </div>
      </section>}

      {rows.length > 0 && rows.every((entry) => !entry.selectedPeriod) && <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">No scored activities or finalized grades are available for this period yet.</div>}
    </div>
  );
}

function FragmentRow({ entry, periodEntry, grade, finalized, expanded, onToggle, categories }) {
  const classRecord = entry.class || {};
  const score = grade ? formatGrade(grade.finalGrade) : "—";
  return <>
    <tr onClick={onToggle} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(); } }} tabIndex={0} role="button" aria-expanded={expanded} className="cursor-pointer transition hover:bg-blue-50/60 focus:bg-blue-50/60 focus:outline-none">
      <td className="px-5 py-4"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700"><BookOpen size={17} /></span><div><p className="font-bold text-gray-900">{entry.subject || "Subject"}</p><p className="mt-0.5 text-xs text-gray-500">Grade {classRecord.gradeLevel || "—"} · Section {classRecord.section || "—"} · {classRecord.name || "Class"}</p></div></div></td>
      <td className="px-4 py-4 text-sm text-gray-600">{entry.teacher?.name || "Unassigned"}</td>
      <td className="px-4 py-4 align-middle"><ComponentSummary categories={categories} /></td>
      <td className="px-4 py-4"><span className={`whitespace-nowrap font-bold ${finalized ? "text-gray-900" : "text-amber-800"}`}>{grade ? `${score}${finalized ? "" : "*"}` : "—"}{grade && !finalized && <span className="ml-1 text-xs font-semibold">(Running)</span>}</span></td>
      <td className="px-4 py-4 text-center align-middle"><StatusBadge finalized={finalized} hasGrade={Boolean(grade)} /></td>
      <td className="px-4 py-4 text-right"><span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">{expanded ? "Hide" : "View breakdown"}{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span></td>
    </tr>
    {expanded && <tr><td colSpan={6} className="bg-slate-50 px-5 py-5">
      {periodEntry ? <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-gray-800">{periodEntry.academicPeriod.name} · {periodEntry.academicPeriod.schoolYear}</h3><p className="text-xs text-gray-500">{finalized ? `Finalized ${formatDate(periodEntry.finalizedAt)}` : "Running grade is based on activities with recorded scores."}</p></div>{grade && <GradeRemark grade={grade.finalGrade} />}</div>
        <div className="grid gap-3 sm:grid-cols-3">{Object.entries(CATEGORY_LABELS).map(([key, label]) => <CategoryBreakdownCard key={key} label={label} category={categories[key]} />)}</div>
        {periodEntry.activities?.length > 0 && <div className="overflow-hidden rounded-lg border border-gray-200 bg-white"><div className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Scored activities</div><div className="divide-y divide-gray-100">{periodEntry.activities.map((activity) => <div key={activity._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><div className="min-w-0"><p className="font-medium text-gray-800">{activity.title}</p><p className="text-xs text-gray-500">{CATEGORY_LABELS[activity.gradingCategory] || activity.gradingCategory}</p>{activity.remarks && <p className="mt-1 text-xs text-gray-600">Feedback: {activity.remarks}</p>}</div><span className="shrink-0 font-semibold text-gray-800">{activity.score} / {activity.totalPoints}</span></div>)}</div></div>}
      </div> : <p className="text-sm text-gray-500">No grades are available for the selected term yet.</p>}
    </td></tr>}
  </>;
}

function ComponentSummary({ categories }) {
  return <div className="grid grid-cols-3 gap-1.5">{Object.entries(CATEGORY_LABELS).map(([key, label]) => <span key={key} title={label} className="flex min-w-0 flex-col items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-1.5 py-1 text-center leading-tight"><span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label === "Written Work" ? "WW" : label === "Performance Task" ? "PT" : "AS"}</span><span className="mt-0.5 whitespace-nowrap text-xs font-semibold text-gray-800">{categories[key] ? `${Number(categories[key].percentage || 0).toFixed(1)}%` : "—"}</span></span>)}</div>;
}

function StatusBadge({ finalized, hasGrade }) {
  if (finalized) return <span className="inline-flex min-w-[118px] items-center justify-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 size={13} /> Finalized</span>;
  if (hasGrade) return <span className="inline-flex min-w-[118px] items-center justify-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"><AlertTriangle size={13} /> In Progress</span>;
  return <span className="inline-flex min-w-[118px] items-center justify-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">Awaiting scores</span>;
}

function CategoryBreakdownCard({ label, category }) {
  const percentage = category ? Number(category.percentage || 0) : null;
  return <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-800">{percentage === null ? "—" : `${percentage.toFixed(1)}%`}</p>{category && <p className="mt-1 text-xs text-gray-500">Scored: {category.earned} / {category.total} pts · Weight {category.weight}%</p>}</div>;
}

function GradeRemark({ grade }) {
  const value = Number(grade);
  const remark = value >= 90 ? "Outstanding" : value >= 85 ? "Very Satisfactory" : value >= 80 ? "Satisfactory" : value >= 75 ? "Fairly Satisfactory" : "Did Not Meet Expectations";
  return <span className="text-sm font-medium text-gray-600">{remark}</span>;
}
