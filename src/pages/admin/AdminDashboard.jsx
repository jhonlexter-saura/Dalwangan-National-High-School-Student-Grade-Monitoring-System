import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useSchoolData } from "../../context/SchoolDataContext";
import { getUsers } from "../../services/schoolDataService";

const summaryCards = [
  {
    key: "classes",
    label: "Total Classes",
    description: "Active classes",
    icon: Users,
    accent: "blue",
    href: "/admin/classes",
  },
  {
    key: "students",
    label: "Total Students",
    description: "Enrolled learners",
    icon: GraduationCap,
    accent: "yellow",
    href: "/admin/classes",
  },
  {
    key: "activities",
    label: "Total Activities",
    description: "Learning activities",
    icon: Activity,
    accent: "red",
    href: "/admin/activities",
  },
  {
    key: "records",
    label: "Grade Records",
    description: "Scores recorded",
    icon: ClipboardCheck,
    accent: "blue",
    href: "/admin/scores",
  },
  {
    key: "accounts",
    label: "User Accounts",
    description: "Students, teachers, and administrators",
    icon: Users,
    accent: "red",
    href: "/admin/accounts",
  },
];

const accentStyles = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    bar: "bg-blue-600",
  },
  yellow: {
    icon: "bg-yellow-100 text-yellow-700",
    bar: "bg-yellow-400",
  },
  red: {
    icon: "bg-red-50 text-red-600",
    bar: "bg-red-500",
  },
};

function AdminDashboard() {
  const { user } = useAuth();
  const { classes, activities, scores } = useSchoolData();
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setAccounts(await getUsers());
      } catch (error) {
        console.error("Failed to load account summary:", error);
        setAccountsError(error.message || "Unable to load accounts.");
      } finally {
        setAccountsLoading(false);
      }
    };

    loadAccounts();
  }, []);

  const totalStudents = classes.reduce(
    (total, classItem) => total + classItem.students.length,
    0
  );

  const totals = {
    classes: classes.length,
    students: totalStudents,
    activities: activities.length,
    records: scores.length,
    accounts: accounts.length,
  };

  const accountSummary = ["student", "teacher", "admin"]
    .map((role) => {
      const count = accounts.filter((account) => account.role === role).length;
      const label = role === "admin" ? "admins" : `${role}s`;
      return `${count} ${label}`;
    })
    .join(" · ");

  const getClassName = (classId) =>
    classes.find((classItem) => classItem.id === classId)?.name ||
    "Unknown class";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl bg-blue-700 px-6 py-7 text-white shadow-sm sm:px-8">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-18 border-yellow-400/80" />
        <div className="absolute bottom-0 right-24 h-2 w-20 bg-red-500" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            DNHS-SGMS Administration
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Administrator Dashboard
          </h1>
          <p className="mt-2 text-sm text-blue-100 sm:text-base">
            Welcome, {user?.name}. Monitor classes, learning activities, and
            grade records in one place.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const style = accentStyles[card.accent];

          return (
            <Link
              key={card.key}
              to={card.href}
              className="group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${style.bar}`} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-blue-700">
                    {card.key === "accounts" && accountsLoading
                      ? "..."
                      : card.key === "accounts" && accountsError
                        ? "—"
                        : totals[card.key]}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {card.key === "accounts"
                      ? accountsError || (accountsLoading ? card.description : accountSummary)
                      : card.description}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${style.icon}`}>
                  <Icon size={22} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600">
                View details
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Academic monitoring
              </p>
              <h2 className="mt-1 text-lg font-bold text-blue-700">
                Class Overview
              </h2>
            </div>
            <Users size={20} className="text-blue-600" />
          </div>

          {classes.length > 0 ? (
            <div className="divide-y">
              {classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {classItem.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Adviser: {classItem.adviser}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {classItem.students.length} students
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No classes available yet." />
          )}
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
                Latest records
              </p>
              <h2 className="mt-1 text-lg font-bold text-blue-700">
                Recent Activities
              </h2>
            </div>
            <BookOpen size={20} className="text-yellow-500" />
          </div>

          {activities.length > 0 ? (
            <div className="divide-y">
              {activities.slice(-4).reverse().map((activity) => (
                <div key={activity.id} className="flex gap-3 px-5 py-4">
                  <div className="mt-0.5 rounded-md bg-red-50 p-2 text-red-600">
                    <Activity size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {activity.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {getClassName(activity.classId)} · {activity.type}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-xs text-gray-400">
                    {activity.date}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No activities available yet." />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 text-blue-700">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-blue-700">Grade Performance Overview</h2>
            <p className="mt-1 text-sm text-gray-600">
              {scores.length > 0
                ? `${scores.length} grade record${scores.length === 1 ? "" : "s"} are available for review.`
                : "No grade records available yet."}
            </p>
          </div>
        </div>
        <Link
          to="/admin/scores"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Review scores
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto mb-3 h-2 w-10 rounded-full bg-yellow-400" />
      <p className="text-sm font-medium text-gray-700">{message}</p>
      <p className="mt-1 text-xs text-gray-500">
        Add records to see them summarized here.
      </p>
    </div>
  );
}

export default AdminDashboard;
