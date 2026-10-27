import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ClipboardList,
  Loader2,
  Save,
  GraduationCap,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import {
  getClasses,
  getAcademicPeriods,
  getActivitiesByClass,
  getScoresByActivity,
  saveScore,
  getClassGradesByPeriod,
  finalizeGradebook,
  unlockGradebook,
} from "../../services/schoolDataService";
import GradebookPanel from "../../components/gradebook/GradebookPanel";

const CATEGORY_LABELS = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

export default function AdminScores({ initialTab = null }) {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedClassId = searchParams.get("classId") || "";
  const requestedPeriodId = searchParams.get("periodId") || "";
  const requestedActivityId = searchParams.get("activityId") || "";
  const requestedTab =
    initialTab || searchParams.get("tab") || "scores";

  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [activities, setActivities] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");

  const [scores, setScores] = useState({});

  const [gradebookData, setGradebookData] = useState(null);
  const [loadingGradebook, setLoadingGradebook] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState(requestedTab);

  /*
   * Load all classes
   */
  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const data = await getClasses();
        setClasses(data || []);

        if (data && data.length > 0) {
          const requestedClass = data.find(
            (item) => String(item._id || item.id) === String(requestedClassId)
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

    loadClasses();
  }, [requestedClassId, showToast]);

  /*
   * Selected class object
   */
  const selectedClass = useMemo(() => {
    return classes.find(
      (item) => String(item._id || item.id) === String(selectedClassId)
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
        const data = await getAcademicPeriods(selectedClass.schoolYear);
        setPeriods(data || []);

        const activePeriod = (data || []).find(
          (period) => period.status === "active"
        );

        const requestedPeriod = (data || []).find(
          (period) => String(period._id) === String(requestedPeriodId)
        );

        if (requestedPeriod) {
          setSelectedPeriodId(requestedPeriod._id);
        } else if (activePeriod) {
          setSelectedPeriodId(activePeriod._id);
        } else if (data && data.length > 0) {
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
   * Load activities for selected class
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
        const data = await getActivitiesByClass(selectedClassId);
        setActivities(data || []);

        const requestedActivity = (data || []).find(
          (activity) => String(activity._id) === String(requestedActivityId)
        );

        setSelectedActivityId(requestedActivity?._id || "");
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
    if (!selectedPeriodId) return [];

    return activities.filter((activity) => {
      const pId =
        activity.academicPeriod?._id ||
        activity.academicPeriod ||
        activity.academicPeriodId;
      return String(pId) === String(selectedPeriodId);
    });
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
        const data = await getScoresByActivity(selectedActivityId);

        const scoreMap = {};
        (data || []).forEach((item) => {
          const studentId = item.student?._id || item.student;
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
   * Load gradebook data
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

  useEffect(() => {
    if (activeTab === "gradebook") {
      loadGradebook();
    }
  }, [selectedClassId, selectedPeriodId, loadGradebook]);

  const selectedActivity = useMemo(() => {
    return activities.find(
      (activity) => String(activity._id) === String(selectedActivityId)
    );
  }, [activities, selectedActivityId]);

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
   * Save all scores for selected activity
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

        if (
          rawScore === "" ||
          rawScore === undefined ||
          rawScore === null
        ) {
          continue;
        }

        const numericScore = Number(rawScore);

        if (Number.isNaN(numericScore)) {
          throw new Error(`Invalid score for ${student.name}.`);
        }

        if (numericScore < 0) {
          throw new Error(
            `Score for ${student.name} cannot be negative.`
          );
        }

        if (numericScore > Number(selectedActivity.totalPoints)) {
          throw new Error(
            `Score for ${student.name} cannot exceed ${selectedActivity.totalPoints}.`
          );
        }

        await saveScore({
          studentId,
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
   * Finalize gradebook (Lock)
   */
  const handleFinalize = async () => {
    if (!selectedClassId || !selectedPeriodId) return;

    try {
      setFinalizing(true);
      await finalizeGradebook(selectedClassId, selectedPeriodId);
      showToast("Gradebook finalized and locked successfully.", "success");
      await loadGradebook();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setFinalizing(false);
    }
  };

  /*
   * Unlock gradebook
   */
  const handleUnlock = async () => {
    if (!selectedClassId || !selectedPeriodId) return;

    try {
      setUnlocking(true);
      await unlockGradebook(selectedClassId, selectedPeriodId);
      showToast("Gradebook unlocked successfully. Grade editing enabled.", "success");
      await loadGradebook();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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
              Scores &amp; Gradebook
            </h1>

            <p className="text-sm text-gray-500">
              Manage student scores and review, finalize, or unlock class gradebooks.
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
                <option key={item._id} value={item._id}>
                  Grade {item.gradeLevel} - {item.name} {item.section}
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
              <option value="">Select academic period</option>

              {periods.map((period) => (
                <option key={period._id} value={period._id}>
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
                disabled={loadingActivities || !selectedPeriodId}
                className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500"
              >
                <option value="">Select activity</option>

                {filteredActivities.map((activity) => (
                  <option key={activity._id} value={activity._id}>
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
                    {selectedClass.students?.map((student) => {
                      const studentId = student._id || student.id;

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
                              value={scores[studentId]?.score ?? ""}
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
                    })}
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
                Select a class, academic period, and activity to enter student scores.
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
          unlocking={unlocking}
          onFinalize={handleFinalize}
          onUnlock={handleUnlock}
          isAdmin={true}
        />
      )}
    </div>
  );
}

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
