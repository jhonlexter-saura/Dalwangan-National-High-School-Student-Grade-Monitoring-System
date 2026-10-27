import { useEffect, useState } from "react";
import {
  GraduationCap,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getMyGrades } from "../../services/schoolDataService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function StudentGrades() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [gradeData, setGradeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getMyGrades();
        setGradeData(data);
      } catch (err) {
        showToast(err.message || "Failed to load grades.", "error");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      load();
    }
  }, [user, showToast]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const schoolYears = [...new Set(
    gradeData.map((entry) => entry.class.schoolYear).filter(Boolean)
  )].sort((a, b) => String(b).localeCompare(String(a)));

  const availableTerms = [...new Map(
    gradeData
      .filter((entry) => selectedSchoolYear === "all" || String(entry.class.schoolYear) === selectedSchoolYear)
      .flatMap((entry) => entry.periods || [])
      .map((periodEntry) => [
        periodEntry.academicPeriod.name,
        periodEntry.academicPeriod,
      ])
  ).values()].sort((a, b) => Number(a.trimester || 0) - Number(b.trimester || 0));

  // Classes with finalized periods matching the selected school year and term.
  const classesWithGrades = gradeData
    .filter((entry) => selectedSchoolYear === "all" || String(entry.class.schoolYear) === selectedSchoolYear)
    .map((entry) => ({
      ...entry,
      periods: (entry.periods || []).filter((periodEntry) =>
        selectedTerm === "all" || periodEntry.academicPeriod.name === selectedTerm
      ),
    }))
    .filter((entry) => entry.periods.length > 0);

  // Classes enrolled but no finalized grades yet
  const classesWithoutGrades = gradeData.filter(
    (entry) =>
      (!entry.periods || entry.periods.length === 0) &&
        (selectedSchoolYear === "all" || String(entry.class.schoolYear) === selectedSchoolYear) &&
        selectedTerm === "all"
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3">
            <GraduationCap className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Grades</h1>
            <p className="text-sm text-gray-500">
              View your finalized grades across all enrolled classes.
            </p>
          </div>
        </div>
      </div>

      {gradeData.length > 0 && (
        <section className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-gray-700">
            School Year
            <select
              value={selectedSchoolYear}
              onChange={(event) => {
                setSelectedSchoolYear(event.target.value);
                setSelectedTerm("all");
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All School Years</option>
              {schoolYears.map((schoolYear) => (
                <option key={schoolYear} value={schoolYear}>School Year {schoolYear}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-sm font-medium text-gray-700">
            Term
            <select
              value={selectedTerm}
              onChange={(event) => setSelectedTerm(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Terms</option>
              {availableTerms.map((term) => (
                <option key={term._id || term.name} value={term.name}>{term.name}</option>
              ))}
            </select>
          </label>
        </section>
      )}

      {/* No enrolment at all */}
      {gradeData.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 font-semibold text-gray-700">
            You are not enrolled in any class yet
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Once your teacher adds you to a class and finalizes the gradebook,
            your grades will appear here.
          </p>
        </div>
      )}

      {/* Classes with finalized grades */}
      {classesWithGrades.map((entry) => (
        <ClassGradeCard key={entry.class._id} entry={entry} />
      ))}

      {gradeData.length > 0 && classesWithGrades.length === 0 && classesWithoutGrades.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">
          No finalized grades match the selected school year and term.
        </div>
      )}

      {/* Enrolled but no finalized grades */}
      {classesWithoutGrades.length > 0 && (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-gray-700">
              Awaiting Grade Finalization
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              These classes have not yet had their gradebook finalized by the teacher.
            </p>
          </div>
          <div className="divide-y">
            {classesWithoutGrades.map((entry) => (
              <div
                key={entry.class._id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <div className="rounded-lg bg-gray-100 p-2.5 text-gray-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">
                    {entry.class.name} —{" "}
                    <span className="text-gray-500">
                      Section {entry.class.section}
                    </span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Grade {entry.class.gradeLevel} · {entry.class.schoolYear}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  Not yet available
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClassGradeCard — one card per class showing all finalized periods
// ---------------------------------------------------------------------------
function ClassGradeCard({ entry }) {
  const { class: classRecord, periods } = entry;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 border-b bg-gradient-to-r from-blue-50 to-white px-5 py-4 text-left transition hover:from-blue-100"
      >
        <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
          <BookOpen className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800">
            {classRecord.name}
          </p>
          <p className="text-sm text-gray-500">
            Section {classRecord.section} · Grade {classRecord.gradeLevel} ·{" "}
            {classRecord.schoolYear}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
            {periods.length} period{periods.length !== 1 ? "s" : ""} finalized
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Periods */}
      {expanded && (
        <div className="divide-y">
          {periods.map((periodEntry) => (
            <PeriodGradeSection
              key={periodEntry.academicPeriod._id}
              periodEntry={periodEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeriodGradeSection — one section per academic period
// ---------------------------------------------------------------------------
function PeriodGradeSection({ periodEntry }) {
  const { academicPeriod, finalizedAt, grade } = periodEntry;

  if (!grade) {
    return (
      <div className="px-5 py-4">
        <p className="text-sm text-gray-500">
          Grade data unavailable for {academicPeriod.name}.
        </p>
      </div>
    );
  }

  const { categories, finalGrade } = grade;

  return (
    <div className="px-5 py-5">
      {/* Period label */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800">
            {academicPeriod.name}
          </h3>
          <p className="text-xs text-gray-400">
            Finalized on {formatDate(finalizedAt)}
          </p>
        </div>
        <FinalGradeBadge grade={finalGrade} />
      </div>

      {/* Category breakdown */}
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const cat = categories?.[key];
          return (
            <CategoryBreakdownCard
              key={key}
              label={label}
              cat={cat}
            />
          );
        })}
      </div>

      {/* Grade interpretation note */}
      <GradeRemark grade={finalGrade} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryBreakdownCard
// ---------------------------------------------------------------------------
function CategoryBreakdownCard({ label, cat }) {
  if (!cat) {
    return (
      <div className="rounded-xl border bg-gray-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-300">—</p>
      </div>
    );
  }

  const pct = cat.percentage?.toFixed(1) ?? "0.0";
  const earned = cat.earned ?? 0;
  const total = cat.total ?? 0;
  const weight = cat.weight ?? 0;
  const contrib = cat.weightedContribution?.toFixed(2) ?? "0.00";

  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-800">
        {pct}
        <span className="text-sm font-normal text-gray-400">%</span>
      </p>

      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${Math.min(100, Number(pct))}%` }}
        />
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-gray-500">
        <p>
          Score: {earned} / {total} pts
        </p>
        <p>
          Weight: {weight}% → contributes {contrib} pts
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FinalGradeBadge
// ---------------------------------------------------------------------------
function FinalGradeBadge({ grade }) {
  const g = Number(grade ?? 0);
  const passed = g >= 75;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-2 ${
        passed
          ? "bg-green-50 text-green-800"
          : "bg-red-50 text-red-800"
      }`}
    >
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-red-500" />
      )}
      <div>
        <p className="text-xs font-medium opacity-70">Final Grade</p>
        <p className="text-xl font-bold leading-none">{g.toFixed(2)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GradeRemark
// ---------------------------------------------------------------------------
function GradeRemark({ grade }) {
  const g = Number(grade ?? 0);

  let remark = "";
  let color = "";

  if (g >= 90) {
    remark = "Outstanding";
    color = "text-green-700";
  } else if (g >= 85) {
    remark = "Very Satisfactory";
    color = "text-green-600";
  } else if (g >= 80) {
    remark = "Satisfactory";
    color = "text-blue-600";
  } else if (g >= 75) {
    remark = "Fairly Satisfactory";
    color = "text-yellow-700";
  } else {
    remark = "Did Not Meet Expectations";
    color = "text-red-600";
  }

  return (
    <p className={`mt-3 text-sm font-medium ${color}`}>
      Remark: {remark}
    </p>
  );
}
