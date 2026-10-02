import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Plus,
  ClipboardList,
  Search,
  X,
  CalendarDays,
  ArrowRight,
} from "lucide-react";

import { useSchoolData } from "../../context/SchoolDataContext";
import { useToast } from "../../context/ToastContext";
import { getAcademicPeriods } from "../../services/schoolDataService";

function AdminActivities() {
  const { classes, activities, createActivity } = useSchoolData();
  const { showToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [activitySearch, setActivitySearch] = useState("");

  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const urlClassId = searchParams.get("classId");

  const selectedClassId =
    urlClassId || classes[0]?.id || "";

  const selectedClass = classes.find(
    (classItem) =>
      String(classItem.id) === String(selectedClassId)
  );

  // --------------------------------------------------
  // Form
  // --------------------------------------------------

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    classId: "",
    type: "activity",
    gradingCategory: "written_work",
    totalPoints: "",
    date: "",
  });

  // --------------------------------------------------
  // Validate selected class
  // --------------------------------------------------

  useEffect(() => {
    if (!classes.length) return;

    const valid = classes.some(
      (classItem) =>
        String(classItem.id) === String(urlClassId)
    );

    if (!urlClassId || !valid) {
      setSearchParams(
        { classId: String(classes[0].id) },
        { replace: true }
      );
    }
  }, [classes, urlClassId, setSearchParams]);

  // --------------------------------------------------
  // Load academic periods
  // --------------------------------------------------

  useEffect(() => {
    const loadPeriods = async () => {
      if (!selectedClass?.schoolYear) {
        setPeriods([]);
        setSelectedPeriodId("");
        return;
      }

      try {
        const data = await getAcademicPeriods(
          selectedClass.schoolYear
        );

        setPeriods(data);

        const activePeriod = data.find(
          (period) => period.status === "active"
        );

        setSelectedPeriodId(
          activePeriod?._id ||
            data[0]?._id ||
            ""
        );
      } catch (error) {
        console.error(
          "Failed to load academic periods:",
          error
        );

        showToast(
          error.message ||
            "Failed to load academic periods.",
          "error"
        );
      }
    };

    loadPeriods();
  }, [selectedClass?.schoolYear, showToast]);

  // --------------------------------------------------
  // Class selection
  // --------------------------------------------------

  const handleClassSelect = (e) => {
    setSearchParams(
      { classId: e.target.value },
      { replace: false }
    );

    setActivitySearch("");
  };

  // --------------------------------------------------
  // Activity filtering
  // --------------------------------------------------

  const selectedActivities = useMemo(() => {
    const query = activitySearch
      .trim()
      .toLowerCase();

    return activities
      .filter(
        (activity) =>
          String(activity.classId) ===
          String(selectedClassId)
      )
      .filter((activity) => {
        const matchesSearch =
          !query ||
          String(activity.title || "")
            .toLowerCase()
            .includes(query) ||
          String(activity.type || "")
            .toLowerCase()
            .includes(query);

        const matchesPeriod =
          !selectedPeriodId ||
          String(
            activity.academicPeriod?._id ||
              activity.academicPeriod ||
              activity.academicPeriodId
          ) === String(selectedPeriodId);

        return matchesSearch && matchesPeriod;
      });
  }, [
    activities,
    activitySearch,
    selectedClassId,
    selectedPeriodId,
  ]);

  const selectedClassActivityCount =
    activities.filter(
      (activity) =>
        String(activity.classId) ===
        String(selectedClassId)
    ).length;

  // --------------------------------------------------
  // Open modal
  // --------------------------------------------------

  const openCreateModal = () => {
    setFormData({
      title: "",
      description: "",
      classId: String(selectedClassId || ""),
      type: "activity",
      gradingCategory: "written_work",
      totalPoints: "",
      date: "",
    });

    setShowModal(true);
  };

  // --------------------------------------------------
  // Form changes
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      // Automatically suggest grading category
      // based on activity type.
      if (name === "type") {
        const defaultCategories = {
          activity: "written_work",
          assignment: "written_work",
          quiz: "written_work",
          project: "performance_task",
          performance_task: "performance_task",
          exam: "assessment",
        };

        next.gradingCategory =
          defaultCategories[value] ||
          prev.gradingCategory;
      }

      return next;
    });
  };

  // --------------------------------------------------
  // Create activity
  // --------------------------------------------------

  const handleCreateActivity = async (e) => {
    e.preventDefault();

    if (isCreating) return;

    if (!formData.title.trim()) {
      showToast(
        "Activity title is required.",
        "warning"
      );
      return;
    }

    if (!formData.classId) {
      showToast(
        "Please select a class.",
        "warning"
      );
      return;
    }

    if (!selectedPeriodId) {
      showToast(
        "Please select an academic period.",
        "warning"
      );
      return;
    }

    const totalPoints = Number(
      formData.totalPoints
    );

    if (!totalPoints || totalPoints <= 0) {
      showToast(
        "Total points must be greater than 0.",
        "warning"
      );
      return;
    }

    if (!formData.date) {
      showToast(
        "Activity date is required.",
        "warning"
      );
      return;
    }

    try {
      setIsCreating(true);

      const created = await createActivity({
        title: formData.title.trim(),
        description: formData.description.trim(),
        classId: formData.classId,
        academicPeriodId: selectedPeriodId,
        type: formData.type,
        gradingCategory:
          formData.gradingCategory,
        totalPoints,
        date: formData.date,
      });

      // The context should update the activity list.
      // If it returns the created activity, this also
      // gives immediate feedback.
      console.log(
        "Activity created:",
        created
      );

      setFormData({
        title: "",
        description: "",
        classId: String(selectedClassId || ""),
        type: "activity",
        gradingCategory: "written_work",
        totalPoints: "",
        date: "",
      });

      setShowModal(false);

      showToast(
        "Activity created successfully.",
        "success"
      );
    } catch (error) {
      console.error(
        "Failed to create activity:",
        error
      );

      showToast(
        error.message ||
          "Failed to create activity.",
        "error"
      );
    } finally {
      setIsCreating(false);
    }
  };

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------

  if (!classes.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <ClipboardList
          size={40}
          className="mx-auto text-gray-400"
        />

        <h2 className="mt-4 font-semibold text-gray-800">
          No classes available
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Create a class before creating activities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ==========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Activities
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create and manage activities for classes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={
            classes.length === 0 ||
            periods.length === 0
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          Create Activity
        </button>
      </div>

      {/* ==========================================
          FILTERS
      ========================================== */}

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-3">

        {/* Class */}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Class
          </label>

          <select
            value={selectedClassId}
            onChange={handleClassSelect}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {classes.map((classItem) => (
              <option
                key={classItem.id}
                value={classItem.id}
              >
                {classItem.name} —{" "}
                {classItem.section}
              </option>
            ))}
          </select>
        </div>

        {/* Trimester */}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Trimester
          </label>

          <select
            value={selectedPeriodId}
            onChange={(e) =>
              setSelectedPeriodId(
                e.target.value
              )
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

        {/* Search */}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Search Activities
          </label>

          <div className="relative mt-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="search"
              value={activitySearch}
              onChange={(e) =>
                setActivitySearch(
                  e.target.value
                )
              }
              placeholder="Search activity..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* ==========================================
          SELECTED CLASS
      ========================================== */}

      {selectedClass && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-sm text-blue-700">
            Showing activities for{" "}
            <span className="font-semibold">
              {selectedClass.name}
            </span>{" "}
            — Section{" "}
            {selectedClass.section},{" "}
            {selectedClass.schoolYear}
          </p>
        </div>
      )}

      {/* ==========================================
          ACTIVITY LIST
      ========================================== */}

      {selectedActivities.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {selectedActivities.map(
            (activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() =>
                  navigate(
                    `/admin/scores?classId=${selectedClassId}&activityId=${activity.id}`
                  )
                }
                className="group w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
              >

                <div className="flex items-start justify-between gap-3">

                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {activity.title}
                    </h2>

                    <p className="mt-1 text-sm capitalize text-blue-600">
                      {String(
                        activity.type ||
                          "activity"
                      ).replace(
                        "_",
                        " "
                      )}
                    </p>

                    {activity.gradingCategory && (
                      <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {activity.gradingCategory ===
                        "written_work"
                          ? "Written Work"
                          : activity.gradingCategory ===
                            "performance_task"
                            ? "Performance Tasks"
                            : "Assessment"}
                      </span>
                    )}
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

                  <div>
                    <span className="font-medium text-gray-700">
                      Points:
                    </span>{" "}
                    {activity.totalPoints}
                  </div>

                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} />

                    {activity.date
                      ? String(
                          activity.date
                        ).slice(0, 10)
                      : "—"}
                  </div>

                  <div>
                    <span className="font-medium text-gray-700">
                      Period:
                    </span>{" "}
                    {activity.academicPeriod
                      ?.name ||
                      periods.find(
                        (period) =>
                          String(
                            period._id
                          ) ===
                          String(
                            activity.academicPeriodId
                          )
                      )?.name ||
                      "—"}
                  </div>
                </div>

                <div className="mt-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      activity.status ===
                      "locked"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {activity.status ===
                    "locked"
                      ? "Locked"
                      : "Active"}
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4 text-sm font-medium text-blue-600">
                  Enter Scores

                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </div>

              </button>
            )
          )}

        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">

          <ClipboardList
            size={40}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 font-semibold text-gray-700">
            {activitySearch
              ? "No matching activities"
              : "No activities for this class"}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {activitySearch
              ? "Try a different activity name or type."
              : "Create an activity to get started."}
          </p>

        </div>
      )}

      {/* ==========================================
          CREATE ACTIVITY MODAL
      ========================================== */}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onMouseDown={(e) => {
            // Prevent accidental closing when clicking
            // the background. Modal only closes through
            // X or Cancel.
            if (
              e.target === e.currentTarget
            ) {
              e.stopPropagation();
            }
          }}
        >

          {/* FIXED HEIGHT MODAL */}

          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

            {/* ------------------------------------------
                MODAL HEADER - ALWAYS VISIBLE
            ------------------------------------------ */}

            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">

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
                  setShowModal(false)
                }
                className="shrink-0 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

            </div>

            {/* ------------------------------------------
                SCROLLABLE FORM BODY
            ------------------------------------------ */}

            <form
              onSubmit={
                handleCreateActivity
              }
              className="flex min-h-0 flex-1 flex-col"
            >

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">

                {/* Activity Title */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Activity Title
                  </label>

                  <input
                    name="title"
                    value={
                      formData.title
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. Quiz 1"
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Description */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={
                      formData.description
                    }
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Optional description"
                    className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Class */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Class
                  </label>

                  <select
                    name="classId"
                    value={
                      formData.classId
                    }
                    onChange={
                      handleChange
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {classes.map(
                      (classItem) => (
                        <option
                          key={
                            classItem.id
                          }
                          value={
                            classItem.id
                          }
                        >
                          {classItem.name}{" "}
                          —{" "}
                          {
                            classItem.section
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Trimester */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Trimester
                  </label>

                  <select
                    value={
                      selectedPeriodId
                    }
                    onChange={(e) =>
                      setSelectedPeriodId(
                        e.target.value
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {periods.map(
                      (period) => (
                        <option
                          key={
                            period._id
                          }
                          value={
                            period._id
                          }
                        >
                          {period.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Type + Points */}

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Activity Type
                    </label>

                    <select
                      name="type"
                      value={
                        formData.type
                      }
                      onChange={
                        handleChange
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

                      <option value="performance_task">
                        Performance Task
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
                      value={
                        formData.totalPoints
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="20"
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                </div>

                {/* Grading Category */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Grading Category
                  </label>

                  <select
                    name="gradingCategory"
                    value={
                      formData.gradingCategory
                    }
                    onChange={
                      handleChange
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="written_work">
                      Written Work
                    </option>

                    <option value="performance_task">
                      Performance Tasks
                    </option>

                    <option value="assessment">
                      Assessment
                    </option>
                  </select>
                </div>

                {/* Date */}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Activity Date
                  </label>

                  <input
                    name="date"
                    type="date"
                    value={
                      formData.date
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Summary */}

                <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">

                  <p>
                    <span className="font-medium text-gray-700">
                      Class:
                    </span>{" "}
                    {selectedClass
                      ? `${selectedClass.name} — ${selectedClass.section}`
                      : "—"}
                  </p>

                  <p className="mt-1">
                    <span className="font-medium text-gray-700">
                      Trimester:
                    </span>{" "}
                    {periods.find(
                      (period) =>
                        String(
                          period._id
                        ) ===
                        String(
                          selectedPeriodId
                        )
                    )?.name ||
                      "—"}
                  </p>

                  <p className="mt-1">
                    <span className="font-medium text-gray-700">
                      Category:
                    </span>{" "}
                    {formData.gradingCategory ===
                    "written_work"
                      ? "Written Work"
                      : formData.gradingCategory ===
                        "performance_task"
                        ? "Performance Tasks"
                        : "Assessment"}
                  </p>

                </div>

              </div>

              {/* ------------------------------------------
                  MODAL FOOTER - ALWAYS VISIBLE
              ------------------------------------------ */}

              <div className="flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  disabled={isCreating}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating
                    ? "Creating..."
                    : "Create Activity"}
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