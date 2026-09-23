import { useEffect, useState } from "react";
import { useSchoolData } from "../../context/SchoolDataContext";

import {
  Save,
  BookOpen,
} from "lucide-react";

function AdminScores() {
  const { classes, activities, scores, saveScores, } = useSchoolData();
  const [scoreInputs, setScoreInputs] = useState({});

  const [selectedClassId, setSelectedClassId] =
    useState("");

  const [selectedActivityId, setSelectedActivityId] =
    useState("");


  const [saved, setSaved] = useState(false);

  const selectedClass = classes.find(
    (classItem) =>
      classItem.id === Number(selectedClassId)
  );

  const availableActivities = activities.filter(
    (activity) =>
      activity.classId === Number(selectedClassId)
  );

  const selectedActivity = activities.find(
    (activity) =>
      activity.id === Number(selectedActivityId)
  );

  const handleClassChange = (e) => {
    setSelectedClassId(e.target.value);

    setSelectedActivityId("");

    setScoreInputs({});

    setSaved(false);
  };

  const handleActivityChange = (e) => {
    setSelectedActivityId(e.target.value);
    setSaved(false);
  };

  // Load previously saved scores whenever the selected
  // class or activity changes.
  useEffect(() => {
    if (!selectedClassId || !selectedActivityId) {
      setScoreInputs({});
      return;
    }

    const existingScores = scores
      .filter(
        (item) =>
          item.classId === Number(selectedClassId) &&
          item.activityId === Number(selectedActivityId)
      )
      .reduce((result, item) => {
        result[item.studentId] = String(item.score);
        return result;
      }, {});

    setScoreInputs(existingScores);
  }, [selectedClassId, selectedActivityId, scores]);

  const handleScoreChange = (studentId, value) => {
  if (value === "") {
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: "",
    }));

    setSaved(false);
    return;
  }

  const numericValue = Number(value);

  if (numericValue < 0) {
    return;
  }

  if (
    selectedActivity &&
    numericValue > selectedActivity.totalPoints
  ) {
    return;
  }

  setScoreInputs((prev) => ({
    ...prev,
    [studentId]: value,
  }));

  setSaved(false);
};
  

  const handleSaveScores = () => {
  if (!selectedClassId || !selectedActivityId || !selectedActivity) {
    return;
  }

  const hasInvalidScore = Object.values(scoreInputs).some(
    (value) => {
      if (value === "") {
        return false;
      }

      const score = Number(value);

      return (
        score < 0 ||
        score > selectedActivity.totalPoints
      );
    }
  );

  if (hasInvalidScore) {
    setSaved(false);
    return;
  }

  saveScores({
    classId: Number(selectedClassId),
    activityId: Number(selectedActivityId),
    scoreData: scoreInputs,
  });

  setSaved(true);
};

  const canEnterScores =
    selectedClass &&
    selectedActivity;

  return (
    <div>
      {/* =========================
          PAGE HEADER
      ========================== */}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Scores
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Enter and manage student scores.
        </p>
      </div>

      {/* =========================
          SELECTION AREA
      ========================== */}

      <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          {/* Class */}

          <div>
            <label
              htmlFor="score-class"
              className="block text-sm font-medium text-gray-700"
            >
              Class
            </label>

            <select
              id="score-class"
              value={selectedClassId}
              onChange={handleClassChange}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                Select a class
              </option>

              {classes.map((classItem) => (
                <option
                  key={classItem.id}
                  value={classItem.id}
                >
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          {/* Activity */}

          <div>
            <label
              htmlFor="score-activity"
              className="block text-sm font-medium text-gray-700"
            >
              Activity
            </label>

            <select
              id="score-activity"
              value={selectedActivityId}
              onChange={handleActivityChange}
              disabled={!selectedClassId}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none disabled:bg-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                Select an activity
              </option>

              {availableActivities.map((activity) => (
                <option
                  key={activity.id}
                  value={activity.id}
                >
                  {activity.title} — {activity.totalPoints} pts
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================
          SCORE ENTRY
      ========================== */}

      {canEnterScores ? (
        <div className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm">
          {/* Table Header */}

          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen
                  size={20}
                  className="text-blue-600"
                />

                <h2 className="font-semibold text-gray-800">
                  {selectedActivity.title}
                </h2>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {selectedClass.name} ·{" "}
                {selectedActivity.totalPoints} points
              </p>
            </div>

            <button
              onClick={handleSaveScores}
              className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save size={17} />
              Save Scores
            </button>
          </div>

          {/* Saved message */}

          {saved && (
            <div className="border-b bg-green-50 px-5 py-3 text-sm text-green-700">
              Scores saved successfully.
            </div>
          )}

          {/* Student Table */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-600 text-left">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold uppercase text-gray-500">
                    Student
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase text-gray-500">
                    Score
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase text-gray-500">
                    Percentage
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {selectedClass.students.map(
                  (student) => {
                    const score = scoreInputs[student.id];

                    const percentage =
                      score !== undefined &&
                      score !== ""
                        ? (
                            (Number(score) /
                              selectedActivity.totalPoints) *
                            100
                          ).toFixed(1)
                        : "—";

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-800">
                            {student.name}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max={
                                selectedActivity.totalPoints
                              }
                              value={scoreInputs[student.id] ?? ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  student.id,
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <span className="text-sm text-gray-500">
                              /
                              {" "}
                              {selectedActivity.totalPoints}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {percentage === "—"
                            ? "—"
                            : `${percentage}%`}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =========================
            EMPTY STATE
        ========================== */

        <div className="mt-6 rounded-lg border bg-white p-10 text-center shadow-sm">
          <BookOpen
            size={40}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 font-semibold text-gray-700">
            Select a class and activity
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Choose a class and activity above to enter
            student scores.
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminScores;