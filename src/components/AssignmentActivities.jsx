import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  X,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getSubjectAssignments,
  getSubjectAssignmentsByTeacher,
  getAcademicPeriods,
  getActivitiesByAssignment,
  createActivity,
  updateActivity,
  deleteActivity,
  getScoresByActivity,
} from "../services/schoolDataService";

const CATEGORIES = {
  written_work: ["activity", "assignment", "quiz"],
  performance_task: ["project", "performance_task"],
  assessment: ["exam"],
};

const CATEGORY_LABEL = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  assessment: "Assessment",
};

const CATEGORY_COLORS = {
  written_work: "bg-blue-100 text-blue-800 border border-blue-200/60",
  performance_task: "bg-amber-100 text-amber-800 border border-amber-200/60",
  assessment: "bg-purple-100 text-purple-800 border border-purple-200/60",
};

/** Format ISO or YYYY-MM-DD date string into human-readable: Nov 19, 2026 */
function formatDate(raw) {
  if (!raw) return "";
  const str = String(raw).slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Convert yyyy-MM-dd from an ISO date string */
function toInputDate(raw) {
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

export default function AssignmentActivities({ admin = false }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState(
    params.get("assignmentId") || ""
  );
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(params.get("periodId") || "");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state (create + edit)
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    gradingCategory: "written_work",
    type: "activity",
    totalPoints: "",
    date: "",
  });

  // Context menu
  const [menuActivityId, setMenuActivityId] = useState(null);
  const menuRef = useRef(null);

  // Grading progress cache: { activityId: { graded, total } }
  const [gradingProgress, setGradingProgress] = useState({});

  const assignment = assignments.find(
    (item) => String(item._id) === String(assignmentId)
  );
  const cls = assignment?.class || {};

  // Grading weights formatting
  const gradingWeightsText = useMemo(() => {
    const components =
      assignment?.gradingSystem?.components || cls?.gradingSystem?.components;
    if (Array.isArray(components) && components.length > 0) {
      return components
        .map((c) => {
          let label = c.name;
          if (/written/i.test(c.name)) label = "Written";
          else if (/performance/i.test(c.name)) label = "Performance";
          else if (/assess/i.test(c.name)) label = "Assessment";
          return `${label} ${c.percentage}%`;
        })
        .join(" · ");
    }
    return "Written 30% · Performance 50% · Assessment 20%";
  }, [assignment, cls]);

  // Date bounds dynamically derived from the active School Year's start and end dates
  const dateBounds = useMemo(() => {
    let min = "";
    let max = "";
    if (periods.length) {
      const starts = periods
        .map((p) => p.startDate)
        .filter(Boolean)
        .map((d) => toInputDate(d));
      const ends = periods
        .map((p) => p.endDate)
        .filter(Boolean)
        .map((d) => toInputDate(d));
      if (starts.length) min = [...starts].sort()[0];
      if (ends.length) max = [...ends].sort().reverse()[0];
    }
    // Fallback if periods dates are missing: parse school year like "2026-2027"
    if ((!min || !max) && cls.schoolYear) {
      const parts = String(cls.schoolYear).split(/[-–]/);
      if (parts.length === 2) {
        const y1 = parseInt(parts[0], 10);
        const y2 = parseInt(parts[1], 10);
        if (!isNaN(y1) && !isNaN(y2)) {
          if (!min) min = `${y1}-06-01`;
          if (!max) max = `${y2}-05-31`;
        }
      }
    }
    // Final fallback: active Philippine calendar year
    if (!min || !max) {
      const now = new Date();
      const startYear =
        now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
      if (!min) min = `${startYear}-06-01`;
      if (!max) max = `${startYear + 1}-05-31`;
    }
    return { min, max };
  }, [periods, cls.schoolYear]);

  const filteredActivities = useMemo(
    () =>
      activities.filter(
        (item) =>
          !periodId ||
          String(
            item.academicPeriod?._id || item.academicPeriod || item.academicPeriodId
          ) === String(periodId)
      ),
    [activities, periodId]
  );

  // ── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    if (!user?._id) return;
    (admin ? getSubjectAssignments() : getSubjectAssignmentsByTeacher(user._id))
      .then((data) => {
        const list = data || [];
        setAssignments(list);
        const selected =
          list.find(
            (item) =>
              String(item._id) === String(params.get("assignmentId"))
          ) ||
          list.find(
            (item) =>
              String(item.class?._id) === String(params.get("classId"))
          ) ||
          list[0];
        setAssignmentId(selected?._id || "");
      })
      .catch((error) =>
        showToast(error.message || "Unable to load assignments.", "error")
      )
      .finally(() => setLoading(false));
  }, [user?._id, admin, showToast]);

  useEffect(() => {
    if (!cls.schoolYear) {
      setPeriods([]);
      setPeriodId("");
      return;
    }
    getAcademicPeriods(cls.schoolYear)
      .then((data) => {
        const list = data || [];
        setPeriods(list);
        setPeriodId(
          list.find(
            (p) => String(p._id) === String(params.get("periodId"))
          )?._id ||
            list.find((p) => p.status === "active")?._id ||
            list[0]?._id ||
            ""
        );
      })
      .catch((error) =>
        showToast(error.message || "Unable to load terms.", "error")
      );
  }, [assignmentId, cls.schoolYear]);

  useEffect(() => {
    if (!assignmentId) {
      setActivities([]);
      return;
    }
    getActivitiesByAssignment(assignmentId)
      .then((data) => setActivities(data || []))
      .catch((error) =>
        showToast(error.message || "Unable to load activities.", "error")
      );
  }, [assignmentId]);

  // Fetch grading progress per activity
  useEffect(() => {
    if (!filteredActivities.length) {
      setGradingProgress({});
      return;
    }
    let cancelled = false;
    const totalStudents = cls.students?.length ?? 0;

    Promise.all(
      filteredActivities.map((act) =>
        getScoresByActivity(act._id)
          .then((scores) => ({
            id: act._id,
            graded: Array.isArray(scores)
              ? scores.filter(
                  (s) =>
                    s.score !== null &&
                    s.score !== undefined &&
                    s.score !== ""
                ).length
              : 0,
            total: totalStudents,
          }))
          .catch(() => ({ id: act._id, graded: 0, total: totalStudents }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      results.forEach((r) => {
        map[r.id] = { graded: r.graded, total: r.total };
      });
      setGradingProgress(map);
    });

    return () => {
      cancelled = true;
    };
  }, [filteredActivities, cls.students]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuActivityId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Form helpers ───────────────────────────────────────────

  const changeCategory = (value) =>
    setForm((old) => ({
      ...old,
      gradingCategory: value,
      type: CATEGORIES[value][0],
    }));

  const openCreateForm = () => {
    setEditingActivity(null);
    setForm({
      title: "",
      description: "",
      gradingCategory: "written_work",
      type: "activity",
      totalPoints: "",
      date: "",
    });
    setShowForm(true);
  };

  const openEditForm = (activity) => {
    setEditingActivity(activity);
    setForm({
      title: activity.title || "",
      description: activity.description || "",
      gradingCategory: activity.gradingCategory || "written_work",
      type: activity.type || "activity",
      totalPoints: String(activity.totalPoints ?? ""),
      date: toInputDate(activity.date),
    });
    setShowForm(true);
    setMenuActivityId(null);
  };

  const handleDuplicate = (activity) => {
    setEditingActivity(null);
    setForm({
      title: `${activity.title} (Copy)`,
      description: activity.description || "",
      gradingCategory: activity.gradingCategory || "written_work",
      type: activity.type || "activity",
      totalPoints: String(activity.totalPoints ?? ""),
      date: toInputDate(activity.date),
    });
    setShowForm(true);
    setMenuActivityId(null);
  };

  const handleDelete = async (activity) => {
    setMenuActivityId(null);
    if (
      !window.confirm(
        `Delete "${activity.title}"? This will also remove all associated scores. This cannot be undone.`
      )
    )
      return;
    try {
      await deleteActivity(activity._id);
      setActivities(await getActivitiesByAssignment(assignmentId));
      showToast("Activity deleted.", "success");
    } catch (error) {
      showToast(error.message || "Unable to delete activity.", "error");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!assignment || !periodId) return;

    const points = Number(form.totalPoints);
    if (
      !Number.isFinite(points) ||
      !Number.isInteger(points) ||
      points < 1 ||
      points > 1000
    ) {
      showToast("Total points must be a whole number between 1 and 1000.", "error");
      return;
    }

    if (dateBounds.min && form.date < dateBounds.min) {
      showToast(
        `Activity date cannot be earlier than ${formatDate(dateBounds.min)}.`,
        "error"
      );
      return;
    }
    if (dateBounds.max && form.date > dateBounds.max) {
      showToast(
        `Activity date cannot be later than ${formatDate(dateBounds.max)}.`,
        "error"
      );
      return;
    }

    try {
      setSaving(true);

      if (editingActivity) {
        await updateActivity(editingActivity._id, {
          title: form.title.trim(),
          description: form.description.trim(),
          gradingCategory: form.gradingCategory,
          type: form.type,
          totalPoints: points,
          date: form.date,
        });
        showToast("Activity updated.", "success");
      } else {
        await createActivity({
          ...form,
          title: form.title.trim(),
          description: form.description.trim(),
          classId: cls._id,
          subjectAssignmentId: assignmentId,
          academicPeriodId: periodId,
          totalPoints: points,
        });
        showToast("Activity created for this subject.", "success");
      }

      setActivities(await getActivitiesByAssignment(assignmentId));
      setShowForm(false);
      setEditingActivity(null);
      setForm({
        title: "",
        description: "",
        gradingCategory: "written_work",
        type: "activity",
        totalPoints: "",
        date: "",
      });
    } catch (error) {
      showToast(error.message || "Unable to save activity.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading assignments...
      </div>
    );

  const studentCount = cls.students?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-sm text-gray-500">
            Each activity belongs to one class and subject.
          </p>
        </div>
        <button
          disabled={!assignment}
          onClick={openCreateForm}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          Create Activity
        </button>
      </header>

      {!assignments.length ? (
        <p className="rounded-xl border bg-white p-8 text-center text-gray-500">
          No subject assignments available.
        </p>
      ) : (
        <>
          {/* Filters: class/subject + term */}
          <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Class and subject
              <select
                value={assignmentId}
                onChange={(e) => {
                  setAssignmentId(e.target.value);
                  const next = new URLSearchParams(params);
                  next.set("assignmentId", e.target.value);
                  next.delete("classId");
                  setParams(next);
                }}
                className="mt-1 w-full rounded-lg border px-3 py-2.5"
              >
                {assignments.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.class?.name} · {item.class?.section} —{" "}
                    {item.subject}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Term
              <select
                value={periodId}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  const next = new URLSearchParams(params);
                  e.target.value
                    ? next.set("periodId", e.target.value)
                    : next.delete("periodId");
                  setParams(next);
                }}
                className="mt-1 w-full rounded-lg border px-3 py-2.5"
              >
                <option value="">Select term</option>
                {periods.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* Context Banner — supplementary metadata only (no repeated class/subject/section) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-medium">
              Teacher: {assignment?.teacher?.name || "Unassigned"}
            </span>
            <span className="text-blue-400">·</span>
            <span>
              {studentCount} {studentCount === 1 ? "student" : "students"} enrolled
            </span>
            <span className="text-blue-400">·</span>
            <span>{gradingWeightsText}</span>
          </div>

          {/* Activity cards grid */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredActivities.map((item) => {
              const progress = gradingProgress[item._id];
              const isMenuOpen = menuActivityId === item._id;

              return (
                <div
                  key={item._id}
                  className="group relative flex flex-col rounded-xl border bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  {/* Card body */}
                  <div className="flex-1 p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2
                        onClick={() =>
                          navigate(
                            `${admin ? "/admin" : "/teacher"}/scores?assignmentId=${assignmentId}&periodId=${periodId}&activityId=${item._id}`
                          )
                        }
                        className="cursor-pointer font-semibold text-gray-900 transition hover:text-blue-600"
                        title="Enter scores for this activity"
                      >
                        {item.title}
                      </h2>

                      {/* ••• Context menu trigger */}
                      <div
                        className="relative"
                        ref={isMenuOpen ? menuRef : undefined}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuActivityId(isMenuOpen ? null : item._id);
                          }}
                          className={`rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 ${
                            isMenuOpen
                              ? "bg-gray-100 opacity-100 text-gray-900"
                              : "sm:opacity-0 sm:group-hover:opacity-100"
                          }`}
                          aria-label="Activity actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => openEditForm(item)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(item)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Copy size={14} /> Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category + type as distinct styled pill badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          CATEGORY_COLORS[item.gradingCategory] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {CATEGORY_LABEL[item.gradingCategory] ||
                          item.gradingCategory?.replaceAll("_", " ")}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                        {item.type?.replaceAll("_", " ")}
                      </span>
                    </div>

                    {/* Points + human-readable formatted date */}
                    <p className="mt-3 text-sm text-gray-500">
                      {item.totalPoints} points · {formatDate(item.date)}
                    </p>
                  </div>

                  {/* Card footer — grading progress + Enter Scores link */}
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <ClipboardList size={14} />
                      {`${progress?.graded ?? 0}/${progress?.total ?? studentCount} Graded`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `${admin ? "/admin" : "/teacher"}/scores?assignmentId=${assignmentId}&periodId=${periodId}&activityId=${item._id}`
                        )
                      }
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-800"
                    >
                      Enter Scores <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          {filteredActivities.length === 0 && (
            <p className="rounded-xl border border-dashed bg-white p-8 text-center text-gray-500">
              No activities for this subject and term.
            </p>
          )}
        </>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingActivity ? "Edit activity" : "Create subject activity"}
              </h2>
              <button
                type="button"
                aria-label="Close activity modal"
                onClick={() => {
                  setShowForm(false);
                  setEditingActivity(null);
                }}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-500">
              {cls.name} · {assignment?.subject}
            </p>

            <label className="block text-sm font-medium text-gray-700">
              Title
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Description
              <textarea
                maxLength={500}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="mt-1 w-full rounded border px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Grading category
                <select
                  value={form.gradingCategory}
                  onChange={(e) => changeCategory(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="written_work">Written Work</option>
                  <option value="performance_task">Performance Task</option>
                  <option value="assessment">Assessment</option>
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Activity type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {CATEGORIES[form.gradingCategory].map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Total points (1–1000)
                <input
                  required
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key))
                      e.preventDefault();
                  }}
                  value={form.totalPoints}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    if (raw === "") {
                      setForm({ ...form, totalPoints: "" });
                      return;
                    }
                    const num = parseInt(raw, 10);
                    if (num > 1000) {
                      setForm({ ...form, totalPoints: "1000" });
                    } else {
                      setForm({ ...form, totalPoints: String(num) });
                    }
                  }}
                  className="mt-1 w-full rounded border px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Date
                <input
                  required
                  type="date"
                  value={form.date}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingActivity(null);
                }}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingActivity
                    ? "Save changes"
                    : "Create activity"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
