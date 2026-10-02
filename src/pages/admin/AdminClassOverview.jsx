import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Users,
  BookOpen,
  UserPlus,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

import { useSchoolData } from "../../context/SchoolDataContext";
import { getActivitiesByClass } from "../../services/schoolDataService";

function AdminClassOverview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { classes } = useSchoolData();

  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState("");

  const selectedClass = useMemo(
    () =>
      classes.find(
        (classItem) => String(classItem.id) === String(id)
      ),
    [classes, id]
  );

  useEffect(() => {
    const loadActivities = async () => {
      if (!id) return;

      try {
        setLoadingActivities(true);
        setError("");

        const data = await getActivitiesByClass(id);

        setActivities(data || []);
      } catch (err) {
        console.error("Failed to load class activities:", err);
        setError(
          err.message || "Failed to load class activities."
        );
      } finally {
        setLoadingActivities(false);
      }
    };

    loadActivities();
  }, [id]);

  if (!selectedClass) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/admin/classes")}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Classes
        </button>

        <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
          <Users
            size={42}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 text-lg font-semibold text-gray-800">
            Class not found
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            The selected class could not be found.
          </p>
        </div>
      </div>
    );
  }

  const students = selectedClass.students || [];

  return (
    <div className="space-y-6">
      {/* =========================
          BREADCRUMB / BACK
      ========================== */}

      <div>
        <button
          type="button"
          onClick={() => navigate("/admin/classes")}
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Classes
        </button>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-600">
            Class Overview
          </p>

          <h1 className="mt-1 text-2xl font-bold text-gray-800">
            {selectedClass.name}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {selectedClass.section
              ? `Section ${selectedClass.section}`
              : "Class"}{" "}
            · {selectedClass.schoolYear}
          </p>
        </div>
      </div>

      {/* =========================
          CLASS SUMMARY
      ========================== */}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-blue-700 px-6 py-5 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-blue-100">
                {selectedClass.schoolYear}
              </p>

              <h2 className="mt-1 text-xl font-bold">
                {selectedClass.name}
              </h2>

              <p className="mt-1 text-sm text-blue-100">
                {selectedClass.section
                  ? `Section ${selectedClass.section}`
                  : "No section specified"}
              </p>
            </div>

            <div className="rounded-lg bg-white/10 p-3">
              <Users size={28} />
            </div>
          </div>
        </div>

        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <SummaryItem
            icon={<Users size={19} />}
            label="Students"
            value={students.length}
          />

          <SummaryItem
            icon={<ClipboardList size={19} />}
            label="Activities"
            value={activities.length}
          />

          <SummaryItem
            icon={<CalendarDays size={19} />}
            label="School Year"
            value={selectedClass.schoolYear || "—"}
          />
        </div>
      </section>

      {/* =========================
          QUICK ACTIONS
      ========================== */}

      <section>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-yellow-600">
            Quick Actions
          </p>

          <h2 className="mt-1 text-lg font-bold text-blue-700">
            Manage this class
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            to={`/admin/activities?classId=${selectedClass.id}`}
            icon={<ClipboardList size={21} />}
            title="Activities"
            description="Create and manage activities for this class."
          />

          <QuickAction
            to={`/admin/classes/${selectedClass.id}/students`}
            icon={<Users size={21} />}
            title="Students"
            description="View and manage students in this class."
          />

          <QuickAction
            to={`/admin/scores?classId=${selectedClass.id}`}
            icon={<BookOpen size={21} />}
            title="Scores"
            description="Review and manage student scores."
          />
        </div>
      </section>

      {/* =========================
          RECENT ACTIVITIES
      ========================== */}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
              Class Records
            </p>

            <h2 className="mt-1 text-lg font-bold text-blue-700">
              Activities
            </h2>
          </div>

          <Link
            to={`/admin/activities?classId=${selectedClass.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            View All
            <ChevronRight size={16} />
          </Link>
        </div>

        {loadingActivities ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            Loading activities...
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-sm text-red-500">
            {error}
          </div>
        ) : activities.length > 0 ? (
          <div className="divide-y">
            {activities.slice(0, 5).map((activity) => (
              <Link
                key={activity._id}
                to={`/admin/scores?classId=${selectedClass.id}&activityId=${activity._id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50"
              >
                <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                  <ClipboardList size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {activity.title}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {activity.type || "Activity"}
                    {activity.totalPoints
                      ? ` · ${activity.totalPoints} points`
                      : ""}
                  </p>
                </div>

                <ChevronRight
                  size={18}
                  className="shrink-0 text-gray-400"
                />
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <ClipboardList
              size={36}
              className="mx-auto text-gray-300"
            />

            <p className="mt-3 text-sm font-medium text-gray-700">
              No activities yet
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Create an activity for this class to see it here.
            </p>

            <Link
              to={`/admin/activities?classId=${selectedClass.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Activity
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {label}
        </p>

        <p className="mt-1 truncate text-sm font-semibold text-gray-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  title,
  description,
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="rounded-lg bg-blue-50 p-3 text-blue-600 transition group-hover:bg-blue-100">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-800 group-hover:text-blue-600">
            {title}
          </h3>

          <ChevronRight
            size={17}
            className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500"
          />
        </div>

        <p className="mt-1 text-sm leading-5 text-gray-500">
          {description}
        </p>
      </div>
    </Link>
  );
}

export default AdminClassOverview;