import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";

const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

export default function GradebookPanel({
  classRecord,
  periodId,
  gradebookData,
  loading = false,
  finalizing = false,
  unlocking = false,
  onFinalize = null,
  onUnlock = null,
  isAdmin = false,
}) {
  if (!classRecord || !periodId) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-gray-400" />
        <h2 className="mt-3 font-semibold text-gray-700">
          Select a class and academic period
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a class and academic period above to view the gradebook.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border bg-white shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const isFinalized = gradebookData?.finalized ?? false;
  const isComplete = gradebookData?.complete ?? false;
  const missingCategories = gradebookData?.missingCategories ?? [];
  const grades = gradebookData?.grades ?? [];

  // Check if class has grading system configured
  const hasGradingSystem = classRecord?.gradingSystem?.enabled;

  return (
    <div className="space-y-4">
      {/* ======================================================== */}
      {/* STATUS BANNER                                            */}
      {/* ======================================================== */}
      {isFinalized ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">
                Gradebook Finalized (Locked)
              </p>
              <p className="text-sm text-green-700">
                {isAdmin
                  ? "Students can view these grades. As an administrator, you can unlock this gradebook to permit adjustments."
                  : "Students can now view their grades for this period."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={onUnlock}
                disabled={unlocking}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {unlocking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    Unlock Gradebook
                  </>
                )}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            )}
          </div>
        </div>
      ) : !isComplete ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-800">
              Gradebook is incomplete — cannot finalize yet
            </p>
            <p className="mt-1 text-sm text-amber-700">
              The following categories have no activities with points assigned for this period:
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {missingCategories.map((key) => (
                <li
                  key={key}
                  className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800"
                >
                  {CATEGORY_LABELS[key] || key}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-600">
              Add at least one activity with a point value for each missing category, then return here to finalize.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-800">
              Gradebook is ready to finalize
            </p>
            <p className="text-sm text-blue-700">
              All three categories have activities. Review the grades below, then finalize to lock and publish them to students.
            </p>
          </div>
        </div>
      )}

      {/* No grading system warning */}
      {!hasGradingSystem && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-sm text-orange-800">
            This class does not have an automatic grading system configured. Grade weights will default to 0%. Configure the grading system in class settings if required.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* GRADE SUMMARY TABLE                                      */}
      {/* ======================================================== */}
      {isComplete && grades.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-5 py-4">
            <h2 className="font-semibold text-gray-800">
              Grade Summary
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Grades are calculated from all scored activities in this period.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Student
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Written Work
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Performance Task
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Assessment
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Final Grade
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {grades.map((entry) => {
                  const studentObj = classRecord?.students?.find(
                    (s) =>
                      (s._id || s.id || s) === entry.studentId ||
                      String(s._id || s.id || s) === String(entry.studentId)
                  );
                  const studentName =
                    studentObj?.name || `Student ${entry.studentId.slice(-6)}`;
                  const studentSchoolId = studentObj?.studentId || "";

                  const ww = entry.categories?.written_work;
                  const pt = entry.categories?.performance_task;
                  const as = entry.categories?.assessment;

                  return (
                    <tr key={entry.studentId} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800">
                          {studentName}
                        </p>
                        {studentSchoolId && (
                          <p className="text-xs text-gray-500">
                            {studentSchoolId}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <CategoryCell cat={ww} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <CategoryCell cat={pt} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <CategoryCell cat={as} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <FinalGradeCell grade={entry.finalGrade} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-gray-50 px-5 py-4">
            <p className="text-xs text-gray-500">
              {isFinalized
                ? isAdmin
                  ? "This gradebook is locked. You can unlock it to permit edits."
                  : "This gradebook is finalized and visible to students."
                : "Once finalized, students will be able to view their grades."}
            </p>

            <div className="flex items-center gap-3">
              {isFinalized && isAdmin ? (
                <button
                  type="button"
                  onClick={onUnlock}
                  disabled={unlocking}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  {unlocking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Unlocking...
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" />
                      Unlock Gradebook
                    </>
                  )}
                </button>
              ) : isFinalized ? (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white opacity-60 cursor-not-allowed"
                >
                  <Lock className="h-4 w-4" />
                  Finalized
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFinalize}
                  disabled={finalizing || !isComplete}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Finalize Gradebook
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incomplete / no grades yet empty state */}
      {isComplete && grades.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 font-semibold text-gray-700">
            No students enrolled
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Add students to this class to see their grade summaries here.
          </p>
        </div>
      )}
    </div>
  );
}

function CategoryCell({ cat }) {
  if (!cat) return <span className="text-gray-400">—</span>;

  const pct = cat.percentage?.toFixed(1) ?? "0.0";
  const contrib = cat.weightedContribution?.toFixed(2) ?? "0.00";
  const weight = cat.weight ?? 0;

  return (
    <div>
      <p className="font-semibold text-gray-800">{pct}%</p>
      <p className="text-xs text-gray-400">
        {contrib} / {weight}%
      </p>
    </div>
  );
}

function FinalGradeCell({ grade }) {
  const g = Number(grade ?? 0);
  const color =
    g >= 75
      ? "text-green-700 bg-green-50"
      : "text-red-700 bg-red-50";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${color}`}
    >
      {g.toFixed(2)}
    </span>
  );
}
