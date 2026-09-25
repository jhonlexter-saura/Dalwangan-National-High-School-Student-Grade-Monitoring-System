import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSchoolData } from "../../context/SchoolDataContext";
import { Save, BookOpen, Check, X } from "lucide-react";

function AdminScores() {
  const { classes, activities, scores, saveScores } = useSchoolData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [scoreInputs, setScoreInputs] = useState({});
  const [saved, setSaved] = useState(false);

  const selectedClassId = searchParams.get("classId") || "";
  const selectedActivityId = searchParams.get("activityId") || "";

  const selectedClass = classes.find(
    (classItem) => String(classItem.id) === String(selectedClassId)
  );

  const availableActivities = activities.filter(
    (activity) =>
      String(activity.classId) === String(selectedClassId)
  );

  const selectedActivity = activities.find(
    (activity) =>
      String(activity.id) === String(selectedActivityId) &&
      String(activity.classId) === String(selectedClassId)
  );

  useEffect(() => {
    if (!classes.length) return;

    const classId = searchParams.get("classId");
    const activityId = searchParams.get("activityId");

    const validClass = classes.some(
      (item) => String(item.id) === String(classId)
    );

    if (!validClass) {
      setSearchParams({}, { replace: true });
      return;
    }

    if (activityId) {
      const validActivity = activities.some(
        (item) =>
          String(item.id) === String(activityId) &&
          String(item.classId) === String(classId)
      );

      if (!validActivity) {
        setSearchParams({ classId }, { replace: true });
      }
    }
  }, [classes, activities, searchParams, setSearchParams]);

  const handleClassChange = (e) => {
    const classId = e.target.value;

    setScoreInputs({});
    setSaved(false);

    if (!classId) {
      setSearchParams({}, { replace: false });
      return;
    }

    setSearchParams({ classId }, { replace: false });
  };

  const handleActivityChange = (e) => {
    const activityId = e.target.value;

    setScoreInputs({});
    setSaved(false);

    if (!activityId) {
      setSearchParams(
        selectedClassId ? { classId: selectedClassId } : {},
        { replace: false }
      );
      return;
    }

    setSearchParams(
      {
        classId: selectedClassId,
        activityId,
      },
      { replace: false }
    );
  };

  useEffect(() => {
    if (!selectedClassId || !selectedActivityId) {
      setScoreInputs({});
      return;
    }

    const existingScores = scores
      .filter(
        (item) =>
          String(item.classId) === String(selectedClassId) &&
          String(item.activityId) === String(selectedActivityId)
      )
      .reduce((result, item) => {
        result[item.studentId] = String(item.score);
        return result;
      }, {});

    setScoreInputs(existingScores);
  }, [selectedClassId, selectedActivityId, scores]);

  const handleScoreChange = (studentId, value) => {
    if (value === "") {
      setScoreInputs((prev) => ({ ...prev, [studentId]: "" }));
      setSaved(false);
      return;
    }

    const numericValue = Number(value);

    if (
      numericValue < 0 ||
      (selectedActivity &&
        numericValue > selectedActivity.totalPoints)
    ) {
      return;
    }

    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: value,
    }));
    setSaved(false);
  };

  const handleSaveScores = async () => {
    if (!selectedClassId || !selectedActivityId || !selectedActivity) {
      return;
    }

    const hasInvalidScore = Object.values(scoreInputs).some((value) => {
      if (value === "") return false;
      const score = Number(value);
      return score < 0 || score > selectedActivity.totalPoints;
    });

    if (hasInvalidScore) return;

    try {
      await saveScores({
        classId: selectedClassId,
        activityId: selectedActivityId,
        scoreData: scoreInputs,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert(error.message);
    }
  };

  const canEnterScores = selectedClass && selectedActivity;

  return (
    <div>
      {saved && (
        <div className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm">
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-white p-4 shadow-lg">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
              <Check size={18} className="text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">Success</p>
              <p className="mt-0.5 text-sm text-gray-500">
                Scores saved successfully.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSaved(false)}
              className="ml-auto shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Scores</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter and manage student scores.
        </p>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Class
            </label>
            <select
              value={selectedClassId}
              onChange={handleClassChange}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="">Select a class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Activity
            </label>
            <select
              value={selectedActivityId}
              onChange={handleActivityChange}
              disabled={!selectedClassId}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none disabled:bg-gray-100 focus:border-blue-500"
            >
              <option value="">Select an activity</option>
              {availableActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.title} — {activity.totalPoints} pts
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {canEnterScores ? (
        <div className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-blue-600" />
                <h2 className="font-semibold text-gray-800">
                  {selectedActivity.title}
                </h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {selectedClass.name} · {selectedActivity.totalPoints} points
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveScores}
              className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Save size={17} />
              Save Scores
            </button>
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[55%]" />
                <col className="w-[25%]" />
                <col className="w-[20%]" />
              </colgroup>

              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-5">
                    Student
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-5">
                    Score
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-5">
                    Percentage
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {selectedClass.students.map((student) => {
                  const score = scoreInputs[student.id];
                  const percentage =
                    score !== undefined && score !== ""
                      ? (
                          (Number(score) /
                            selectedActivity.totalPoints) *
                          100
                        ).toFixed(1)
                      : "—";

                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="min-w-0 px-4 py-3 sm:px-5 sm:py-4">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {student.name}
                        </p>
                      </td>

                      <td className="px-4 py-3 sm:px-5 sm:py-4">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            max={selectedActivity.totalPoints}
                            value={scoreInputs[student.id] ?? ""}
                            onChange={(e) =>
                              handleScoreChange(
                                student.id,
                                e.target.value
                              )
                            }
                            placeholder="0"
                            className="w-16 rounded-md border border-gray-300 px-2.5 py-2 text-sm outline-none focus:border-blue-500 sm:w-20"
                          />
                          <span className="text-sm text-gray-500">
                            / {selectedActivity.totalPoints}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:px-5 sm:py-4">
                        {percentage === "—" ? "—" : `${percentage}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border bg-white p-10 text-center shadow-sm">
          <BookOpen size={40} className="mx-auto text-gray-400" />
          <h2 className="mt-4 font-semibold text-gray-700">
            Select a class and activity
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose a class and activity above to enter student scores.
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminScores;
