import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ClipboardList,
  Loader2,
  Save,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

import {
  getClassesByTeacher,
  getAcademicPeriods,
  getActivitiesByClass,
  getScoresByActivity,
  saveScore,
  getClassGradesByPeriod,
  finalizeGradebook,
} from "../../services/schoolDataService";

// ---------------------------------------------------------------------------
// Human-readable category labels
// ---------------------------------------------------------------------------
const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TeacherScores() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const requestedClassId = searchParams.get("classId") || "";
  const requestedPeriodId = searchParams.get("periodId") || "";
  const requestedActivityId = searchParams.get("activityId") || "";

  // ---- data ----
  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [activities, setActivities] = useState([]);

  // ---- selections ----
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");

  // ---- scores (activity-level entry) ----
  const [scores, setScores] = useState({});

  // ---- gradebook (period-level summary) ----
  const [gradebookData, setGradebookData] = useState(null);
  const [loadingGradebook, setLoadingGradebook] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // ---- loading / saving flags ----
  const [loading, setLoading] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- active tab: "scores" | "gradebook" ----
  const [activeTab, setActiveTab] = useState("scores");

  /*
   * Load teacher's classes
   */
  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);

        const data = await getClassesByTeacher(user._id);

        setClasses(data);

        if (data.length > 0) {
          const requestedClass = data.find(
            (item) => item._id === requestedClassId
          );

          setSelectedClassId(
            requestedClass?._id || data[0]._id
          );
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setLoading(false);
      }
    }

    if (user?._id) {
      loadClasses();
    }
  }, [user, requestedClassId, showToast]);

  /*
   * Selected class object
   */
  const selectedClass = useMemo(() => {
    return classes.find(
      (item) => item._id === selectedClassId
    );
  }, [classes, selectedClassId]);

  /*
   * Load academic periods
   */
  useEffect(() => {
    async function loadPeriods() {
      if (!selectedClass?.schoolYear) {
        setPeriods([]);
        setSelectedPeriodId("");
        return;
      }

      try {
        setLoadingPeriods(true);

        const data = await getAcademicPeriods(
          selectedClass.schoolYear
        );

        setPeriods(data);

        const activePeriod = data.find(
          (period) => period.status === "active"
        );

        const requestedPeriod = data.find(
          (period) => period._id === requestedPeriodId
        );

        if (requestedPeriod) {
          setSelectedPeriodId(requestedPeriod._id);
        } else if (activePeriod) {
          setSelectedPeriodId(activePeriod._id);
        } else if (data.length > 0) {
          setSelectedPeriodId(data[0]._id);
        } else {
          setSelectedPeriodId("");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setLoadingPeriods(false);
      }
    }

    loadPeriods();
  }, [selectedClass, requestedPeriodId, showToast]);

  /*
   * Load activities
   */
  useEffect(() => {
    async function loadActivities() {
      if (!selectedClassId) {
        setActivities([]);
        setSelectedActivityId("");
        return;
      }

      try {
        setLoadingActivities(true);

        const data = await getActivitiesByClass(
          selectedClassId
        );

        setActivities(data);

        const requestedActivity = data.find(
          (activity) => activity._id === requestedActivityId
        );

        setSelectedActivityId(
          requestedActivity?._id || ""
        );
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setLoadingActivities(false);
      }
    }

    loadActivities();
  }, [selectedClassId, requestedActivityId, showToast]);

  /*
   * Activities belonging to selected period
   */
  const filteredActivities = useMemo(() => {
    if (!selectedPeriodId) {
      return [];
    }

    return activities.filter(
      (activity) =>
        activity.academicPeriod?._id === selectedPeriodId ||
        activity.academicPeriod === selectedPeriodId ||
        activity.academicPeriodId === selectedPeriodId
    );
  }, [activities, selectedPeriodId]);

  /*
   * Load existing scores for selected activity
   */
  useEffect(() => {
    async function loadScores() {
      if (!selectedActivityId) {
        setScores({});
        return;
      }

      try {
        setLoadingScores(true);

        const data = await getScoresByActivity(
          selectedActivityId
        );

        const scoreMap = {};

        data.forEach((item) => {
          const studentId =
            item.student?._id || item.student;

          scoreMap[studentId] = {
            score: item.score,
            remarks: item.remarks || "",
          };
        });

        setScores(scoreMap);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setLoadingScores(false);
      }
    }

    loadScores();
  }, [selectedActivityId, showToast]);

  /*
   * Load gradebook data whenever class or period changes and Gradebook tab is active
   */
  const loadGradebook = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId) {
      setGradebookData(null);
      return;
    }

    try {
      setLoadingGradebook(true);
      const data = await getClassGradesByPeriod(
        selectedClassId,
        selectedPeriodId
      );
      setGradebookData(data);
    } catch (err) {
      showToast(err.message, "error");
      setGradebookData(null);
    } finally {
      setLoadingGradebook(false);
    }
  }, [selectedClassId, selectedPeriodId, showToast]);

  useEffect(() => {
    if (activeTab === "gradebook") {
      loadGradebook();
    }
  }, [activeTab, loadGradebook]);

  // Also reload gradebook data when class/period changes while on that tab
  useEffect(() => {
    if (activeTab === "gradebook") {
      loadGradebook();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedPeriodId]);

  /*
   * Selected activity object
   */
  const selectedActivity = useMemo(() => {
    return activities.find(
      (activity) => activity._id === selectedActivityId
    );
  }, [activities, selectedActivityId]);

  /*
   * Change score
   */
  const handleScoreChange = (studentId, value) => {
    setScores((previous) => ({
      ...previous,
      [studentId]: {
        ...(previous[studentId] || {}),
        score: value,
      },
    }));
  };

  /*
   * Save all scores for current activity
   */
  const handleSaveScores = async () => {
    if (!selectedClassId) {
      showToast("Please select a class.", "warning");
      return;
    }

    if (!selectedActivity) {
      showToast("Please select an activity.", "warning");
      return;
    }

    const students = selectedClass?.students || [];

    if (students.length === 0) {
      showToast("There are no students enrolled in this class.", "warning");
      return;
    }

    try {
      setSaving(true);

      for (const student of students) {
        const studentId = student._id || student.id;

        const rawScore = scores[studentId]?.score;

        /*
         * Skip empty scores
         */
        if (
          rawScore === "" ||
          rawScore === undefined ||
          rawScore === null
        ) {
          continue;
        }

        const numericScore = Number(rawScore);

        if (Number.isNaN(numericScore)) {
          throw new Error(
            `Invalid score for ${student.name}.`
          );
        }

        if (numericScore < 0) {
          throw new Error(
            `Score for ${student.name} cannot be negative.`
          );
        }

        if (
          numericScore >
          Number(selectedActivity.totalPoints)
        ) {
          throw new Error(
            `Score for ${student.name} cannot exceed ${selectedActivity.totalPoints}.`
          );
        }

        await saveScore({
          studentId: studentId,
          classId: selectedClassId,
          activityId: selectedActivityId,
          score: numericScore,
          remarks: scores[studentId]?.remarks || "",
        });
      }

      showToast("Scores saved successfully.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  /*
   * Finalize gradebook
   */
  const handleFinalize = async () => {
    if (!selectedClassId || !selectedPeriodId) return;

    try {
      setFinalizing(true);
      await finalizeGradebook(selectedClassId, selectedPeriodId);
      showToast("Gradebook finalized successfully.", "success");
      // Reload gradebook state to reflect finalization
      await loadGradebook();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setFinalizing(false);
    }
  };

  /*
   * Loading
   */
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3">
            <ClipboardList className="h-6 w-6 text-blue-600" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Student Scores
            </h1>

            <p className="text-sm text-gray-500">
              Add and manage student scores
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Class */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Class
            </label>

            <select
              value={selectedClassId}
              onChange={(event) =>
                setSelectedClassId(event.target.value)
              }
              className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500"
            >
              <option value="">Select class</option>

              {classes.map((item) => (
                <option
                  key={item._id}
                  value={item._id}
                >
                  Grade {item.gradeLevel} - {item.name}{" "}
                  {item.section}
                </option>
              ))}
            </select>
          </div>

          {/* Academic period */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Academic Period
            </label>

            <select
              value={selectedPeriodId}
              onChange={(event) =>
                setSelectedPeriodId(event.target.value)
              }
              disabled={loadingPeriods}
              className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500"
            >
              <option value="">
                Select academic period
              </option>

              {periods.map((period) => (
                <option
                  key={period._id}
                  value={period._id}
                >
                  {period.name}
                </option>
              ))}
            </select>
          </div>

          {/* Activity – only shown in Scores tab */}
          {activeTab === "scores" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Activity
              </label>

              <select
                value={selectedActivityId}
                onChange={(event) =>
                  setSelectedActivityId(event.target.value)
                }
                disabled={
                  loadingActivities ||
                  !selectedPeriodId
                }
                className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500"
              >
                <option value="">
                  Select activity
                </option>

                {filteredActivities.map((activity) => (
                  <option
                    key={activity._id}
                    value={activity._id}
                  >
                    {activity.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      {selectedClassId && selectedPeriodId && (
        <div className="flex gap-1 rounded-xl border bg-white p-1 shadow-sm">
          <TabButton
            active={activeTab === "scores"}
            onClick={() => setActiveTab("scores")}
            icon={<BookOpen className="h-4 w-4" />}
            label="Score Entry"
          />
          <TabButton
            active={activeTab === "gradebook"}
            onClick={() => setActiveTab("gradebook")}
            icon={<GraduationCap className="h-4 w-4" />}
            label="Gradebook"
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: SCORES                                                  */}
      {/* ============================================================ */}
      {activeTab === "scores" && (
        <>
          {/* Activity information */}
          {selectedActivity && (
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />

                    <h2 className="font-semibold text-gray-800">
                      {selectedActivity.title}
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-gray-500">
                    {selectedActivity.type}
                    {selectedActivity.gradingCategory && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {CATEGORY_LABELS[selectedActivity.gradingCategory] ||
                          selectedActivity.gradingCategory}
                      </span>
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm">
                  Total Points:{" "}
                  <span className="font-semibold">
                    {selectedActivity.totalPoints}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Scores table */}
          {selectedActivity && selectedClass && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                        Student
                      </th>

                      <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                        Student ID
                      </th>

                      <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                        Score
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {selectedClass.students?.map(
                      (student) => {
                        const studentId =
                          student._id || student.id;

                        return (
                          <tr key={studentId}>
                            <td className="px-5 py-4">
                              <div className="font-medium text-gray-800">
                                {student.name}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-500">
                              {student.studentId}
                            </td>

                            <td className="px-5 py-4">
                              <input
                                type="number"
                                min="0"
                                max={selectedActivity.totalPoints}
                                value={
                                  scores[studentId]?.score ??
                                  ""
                                }
                                onChange={(event) =>
                                  handleScoreChange(
                                    studentId,
                                    event.target.value
                                  )
                                }
                                className="w-28 rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
                                placeholder="Score"
                              />
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* Save */}
              <div className="flex justify-end border-t bg-gray-50 p-4">
                <button
                  type="button"
                  onClick={handleSaveScores}
                  disabled={saving || loadingScores}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Scores
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!selectedActivity && (
            <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-gray-400" />

              <h2 className="mt-3 font-semibold text-gray-700">
                Select an activity
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Select a class, academic period, and activity
                to enter student scores.
              </p>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* TAB: GRADEBOOK                                               */}
      {/* ============================================================ */}
      {activeTab === "gradebook" && (
        <GradebookPanel
          classRecord={selectedClass}
          periodId={selectedPeriodId}
          gradebookData={gradebookData}
          loading={loadingGradebook}
          finalizing={finalizing}
          onFinalize={handleFinalize}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabButton
// ---------------------------------------------------------------------------
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GradebookPanel
// ---------------------------------------------------------------------------
function GradebookPanel({
  classRecord,
  periodId,
  gradebookData,
  loading,
  finalizing,
  onFinalize,
}) {
  if (!classRecord || !periodId) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-gray-400" />
        <h2 className="mt-3 font-semibold text-gray-700">
          Select a class and academic period
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a class and period above to view the gradebook.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border bg-white shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const isFinalized = gradebookData?.finalized ?? false;
  const isComplete = gradebookData?.complete ?? false;
  const missingCategories = gradebookData?.missingCategories ?? [];
  const grades = gradebookData?.grades ?? [];

  // No grading system configured
  const hasGradingSystem = classRecord?.gradingSystem?.enabled;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isFinalized ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">
              Gradebook Finalized
            </p>
            <p className="text-sm text-green-700">
              Students can now view their grades for this period.
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <Lock className="h-3 w-3" />
            Locked
          </span>
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
              All three categories have activities. Review the grades below, then finalize to make them visible to students.
            </p>
          </div>
        </div>
      )}

      {/* No grading system warning */}
      {!hasGradingSystem && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-sm text-orange-800">
            This class does not have a grading system configured. Grade weights will default to 0% — grades may not reflect accurately. Configure the grading system when creating or editing the class.
          </p>
        </div>
      )}

      {/* Grade summary table */}
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
                  // Try to resolve student name from classRecord
                  const studentObj = classRecord?.students?.find(
                    (s) =>
                      (s._id || s.id || s) === entry.studentId ||
                      String(s._id || s.id || s) === String(entry.studentId)
                  );
                  const studentName =
                    studentObj?.name || `Student ${entry.studentId.slice(-6)}`;
                  const studentSchoolId =
                    studentObj?.studentId || "";

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

          {/* Finalize button */}
          <div className="flex items-center justify-between border-t bg-gray-50 px-5 py-4">
            <p className="text-xs text-gray-500">
              {isFinalized
                ? "This gradebook is finalized and visible to students."
                : "Once finalized, students will be able to view their grades."}
            </p>

            <button
              type="button"
              onClick={onFinalize}
              disabled={isFinalized || finalizing || !isComplete}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {finalizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finalizing...
                </>
              ) : isFinalized ? (
                <>
                  <Lock className="h-4 w-4" />
                  Finalized
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Finalize Gradebook
                </>
              )}
            </button>
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

// ---------------------------------------------------------------------------
// CategoryCell — shows percentage + weighted contribution
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// FinalGradeCell
// ---------------------------------------------------------------------------
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
