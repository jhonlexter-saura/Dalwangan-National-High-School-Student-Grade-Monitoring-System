import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ClipboardList,
  CalendarDays,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  getClassesByTeacher,
  getAcademicPeriods,
  getActivitiesByClass,
  createActivity,
} from "../../services/schoolDataService";

function TeacherActivities() {
  const { user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [activities, setActivities] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "activity",
    totalPoints: "",
    date: "",
  });

  // --------------------------------------------------
  // Load teacher's classes
  // --------------------------------------------------

  useEffect(() => {
    const loadClasses = async () => {
      if (!user?._id) return;

      try {
        setLoading(true);
        setError("");

        const data = await getClassesByTeacher(user._id);

        setClasses(data);

        if (data.length > 0) {
          setSelectedClassId(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to load classes:", err);

        setError(
          err.message || "Failed to load your classes."
        );
      } finally {
        setLoading(false);
      }
    };

    loadClasses();
  }, [user?._id]);

  // --------------------------------------------------
  // Load academic periods whenever class changes
  // --------------------------------------------------

  useEffect(() => {
    const loadPeriods = async () => {
      const selectedClass = classes.find(
        (item) => item._id === selectedClassId
      );

      if (!selectedClass) {
        setPeriods([]);
        setSelectedPeriodId("");
        return;
      }

      try {
        setError("");

        const data = await getAcademicPeriods(
          selectedClass.schoolYear
        );

        setPeriods(data);

        const activePeriod = data.find(
          (period) => period.status === "active"
        );

        setSelectedPeriodId(
          activePeriod?._id || data[0]?._id || ""
        );
      } catch (err) {
        console.error(
          "Failed to load academic periods:",
          err
        );

        setError(
          err.message ||
            "Failed to load academic periods."
        );
      }
    };

    loadPeriods();
  }, [selectedClassId, classes]);

  // --------------------------------------------------
  // Load activities
  // --------------------------------------------------

  useEffect(() => {
    const loadActivities = async () => {
      if (!selectedClassId) {
        setActivities([]);
        return;
      }

      try {
        setLoadingActivities(true);

        const data =
          await getActivitiesByClass(selectedClassId);

        setActivities(data);
      } catch (err) {
        console.error(
          "Failed to load activities:",
          err
        );

        setError(
          err.message ||
            "Failed to load activities."
        );
      } finally {
        setLoadingActivities(false);
      }
    };

    loadActivities();
  }, [selectedClassId]);

  // --------------------------------------------------
  // Filter by trimester
  // --------------------------------------------------

  const visibleActivities = useMemo(() => {
    if (!selectedPeriodId) {
      return activities;
    }

    return activities.filter(
      (activity) =>
        (activity.academicPeriod?._id ||
          activity.academicPeriod) ===
        selectedPeriodId
    );
  }, [activities, selectedPeriodId]);

  // --------------------------------------------------
  // Form handlers
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();

    if (!selectedClassId) {
      setError("Please select a class.");
      return;
    }

    if (!selectedPeriodId) {
      setError("Please select a trimester.");
      return;
    }

    if (
      !formData.title ||
      !formData.totalPoints ||
      !formData.date
    ) {
      setError(
        "Title, total points, and date are required."
      );
      return;
    }

    try {
      setError("");
      setSuccess("");

      const created = await createActivity({
        title: formData.title,
        description: formData.description,
        classId: selectedClassId,
        academicPeriodId: selectedPeriodId,
        type: formData.type,
        totalPoints: Number(formData.totalPoints),
        date: formData.date,
      });

      setActivities((prev) => [created, ...prev]);

      setFormData({
        title: "",
        description: "",
        type: "activity",
        totalPoints: "",
        date: "",
      });

      setShowCreateModal(false);

      setSuccess("Activity created successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error(
        "Failed to create activity:",
        err
      );

      setError(
        err.message || "Failed to create activity."
      );
    }
  };

  const selectedClass = classes.find(
    (item) => item._id === selectedClassId
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading activities...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Activities
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create and manage activities for your classes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={
            classes.length === 0 ||
            periods.length === 0
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          Create Activity
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Class
          </label>

          <select
            value={selectedClassId}
            onChange={(e) =>
              setSelectedClassId(e.target.value)
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {classes.length === 0 ? (
              <option value="">
                No classes available
              </option>
            ) : (
              classes.map((item) => (
                <option
                  key={item._id}
                  value={item._id}
                >
                  {item.name} — {item.section}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Trimester
          </label>

          <select
            value={selectedPeriodId}
            onChange={(e) =>
              setSelectedPeriodId(e.target.value)
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {periods.length === 0 ? (
              <option value="">
                No academic periods available
              </option>
            ) : (
              periods.map((period) => (
                <option
                  key={period._id}
                  value={period._id}
                >
                  {period.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Selected class */}
      {selectedClass && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-sm text-blue-700">
            Showing activities for{" "}
            <span className="font-semibold">
              {selectedClass.name}
            </span>{" "}
            — Section {selectedClass.section},{" "}
            {selectedClass.schoolYear}
          </p>
        </div>
      )}

      {/* Activity list */}
      {loadingActivities ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading activities...
        </div>
      ) : visibleActivities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList
            size={40}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 font-semibold text-gray-900">
            No activities yet
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create an activity for this trimester.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleActivities.map((activity) => (
            <div
              key={activity._id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {activity.title}
                  </h2>

                  <p className="mt-1 text-sm capitalize text-blue-600">
                    {activity.type}
                  </p>
                </div>

                <ClipboardList
                  size={20}
                  className="text-blue-600"
                />
              </div>

              {activity.description && (
                <p className="mt-4 text-sm text-gray-500">
                  {activity.description}
                </p>
              )}

              <div className="mt-5 space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">
                    Points:
                  </span>

                  {activity.totalPoints}
                </div>

                <div className="flex items-center gap-2">
                  <CalendarDays size={16} />

                  {activity.date
                    ? String(activity.date).slice(0, 10)
                    : "—"}
                </div>

                <div>
                  <span className="font-medium text-gray-700">
                    Period:
                  </span>{" "}
                  {activity.academicPeriod?.name ||
                    "—"}
                </div>
              </div>

              <div className="mt-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    activity.status === "locked"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {activity.status === "locked"
                    ? "Locked"
                    : "Active"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Activity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Create Activity
                </h2>

                <p className="text-sm text-gray-500">
                  Add an activity to the selected class.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreateModal(false)
                }
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateActivity}
              className="space-y-5 p-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Activity Title
                </label>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Quiz 1"
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Optional description"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type
                  </label>

                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                  >
                    <option value="activity">
                      Activity
                    </option>
                    <option value="assignment">
                      Assignment
                    </option>
                    <option value="quiz">
                      Quiz
                    </option>
                    <option value="project">
                      Project
                    </option>
                    <option value="exam">
                      Exam
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Total Points
                  </label>

                  <input
                    name="totalPoints"
                    type="number"
                    min="1"
                    value={formData.totalPoints}
                    onChange={handleChange}
                    placeholder="20"
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date
                </label>

                <input
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
                />
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p>
                  <span className="font-medium">
                    Class:
                  </span>{" "}
                  {selectedClass?.name || "—"}
                </p>

                <p className="mt-1">
                  <span className="font-medium">
                    Trimester:
                  </span>{" "}
                  {periods.find(
                    (period) =>
                      period._id === selectedPeriodId
                  )?.name || "—"}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreateModal(false)
                  }
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherActivities;