import { useState } from "react";
import { useSchoolData } from "../../context/SchoolDataContext";

import {
  Plus,
  ClipboardList,
  X,
} from "lucide-react";

function AdminActivities() {
  const {classes, activities, createActivity,} = useSchoolData();

  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    classId: "",
    type: "Quiz",
    totalPoints: "",
    date: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateActivity = (e) => {
    e.preventDefault();

    if (
      !formData.title ||
      !formData.classId ||
      !formData.totalPoints ||
      !formData.date
    ) {
      return;
    }

    const totalPoints = Number(formData.totalPoints);

    if (totalPoints <= 0) {
      return;
    }

    if (isCreating) {
      return;
    }

    setIsCreating(true);

    createActivity({
      title: formData.title,
      classId: Number(formData.classId),
      type: formData.type,
      totalPoints,
      date: formData.date,
    });

    setFormData({
      title: "",
      classId: "",
      type: "Quiz",
      totalPoints: "",
      date: "",
    });

    setShowModal(false);
    setIsCreating(false);
  };

  const getClassName = (classId) => {
    const selectedClass = classes.find(
      (classItem) => classItem.id === classId
    );

    return selectedClass?.name || "Unknown Class";
  };

  return (
    <div>
      {/* =========================
          PAGE HEADER
      ========================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Activities
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create and manage class activities.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Activity
        </button>
      </div>

      {/* =========================
          ACTIVITY LIST
      ========================== */}

      <div className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm">
        {activities.length > 0 ? (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="w-[32%] px-3 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-4">
                    Activity
                  </th>

                  <th className="w-[28%] px-3 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-4">
                    Class
                  </th>

                  <th className="w-[18%] px-3 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-4">
                    Type
                  </th>

                  <th className="w-[10%] px-3 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-4">
                    Points
                  </th>

                  <th className="w-[12%] px-3 py-3 text-xs font-semibold uppercase text-gray-500 sm:px-4">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {activities.map((activity) => (
                  <tr
                    key={activity.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="shrink-0 rounded-md bg-blue-50 p-1.5 text-blue-600">
                          <ClipboardList size={16} />
                        </div>

                        <span className="truncate text-sm font-medium text-gray-800" title={activity.title}>
                          {activity.title}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      <span className="block truncate" title={getClassName(activity.classId)}>
                        {getClassName(activity.classId)}
                      </span>
                    </td>

                    <td className="px-3 py-3 sm:px-4">
                      <span className="inline-block max-w-full truncate rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {activity.type}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      {activity.totalPoints}
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      {activity.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <ClipboardList
              size={40}
              className="mx-auto text-gray-400"
            />

            <h2 className="mt-4 font-semibold text-gray-700">
              No activities yet
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create an activity to get started.
            </p>
          </div>
        )}
      </div>

      {/* =========================
          CREATE ACTIVITY MODAL
      ========================== */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
            {/* Header */}

            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Create Activity
                </h2>

                <p className="text-sm text-gray-500">
                  Add a new activity.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}

            <form
              onSubmit={handleCreateActivity}
              className="space-y-5 p-6"
            >
              {/* Activity Name */}

              <div>
                <label
                  htmlFor="activity-title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Activity Name
                </label>

                <input
                  id="activity-title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Quiz 2"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Class */}

              <div>
                <label
                  htmlFor="activity-class"
                  className="block text-sm font-medium text-gray-700"
                >
                  Class
                </label>

                <select
                  id="activity-class"
                  name="classId"
                  value={formData.classId}
                  onChange={handleChange}
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

              {/* Type */}

              <div>
                <label
                  htmlFor="activity-type"
                  className="block text-sm font-medium text-gray-700"
                >
                  Activity Type
                </label>

                <select
                  id="activity-type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Quiz">
                    Quiz
                  </option>

                  <option value="Assignment">
                    Assignment
                  </option>

                  <option value="Performance Task">
                    Performance Task
                  </option>

                  <option value="Exam">
                    Exam
                  </option>
                </select>
              </div>

              {/* Points */}

              <div>
                <label
                  htmlFor="total-points"
                  className="block text-sm font-medium text-gray-700"
                >
                  Total Points
                </label>

                <input
                  id="total-points"
                  name="totalPoints"
                  type="number"
                  min="1"
                  value={formData.totalPoints}
                  onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalPoints: e.target.value,
                      })
                    }
                  placeholder="e.g. 20"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Date */}

              <div>
                <label
                  htmlFor="activity-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Activity Date
                </label>

                <input
                  id="activity-date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Buttons */}

              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminActivities;