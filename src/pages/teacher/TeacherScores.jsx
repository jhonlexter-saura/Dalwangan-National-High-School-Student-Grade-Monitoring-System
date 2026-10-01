import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ClipboardList,
  Loader2,
  Save,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

import {
  getClassesByTeacher,
  getAcademicPeriods,
  getActivitiesByClass,
  getScoresByActivity,
  saveScore,
} from "../../services/schoolDataService";

export default function TeacherScores() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const requestedClassId = searchParams.get("classId") || "";
  const requestedPeriodId = searchParams.get("periodId") || "";
  const requestedActivityId = searchParams.get("activityId") || "";

  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [activities, setActivities] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");

  const [scores, setScores] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);

  const [saving, setSaving] = useState(false);


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
   * Selected class
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
   * Selected activity
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
   * Save all scores
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

          {/* Activity */}
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
        </div>
      </div>

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
    </div>
  );
}