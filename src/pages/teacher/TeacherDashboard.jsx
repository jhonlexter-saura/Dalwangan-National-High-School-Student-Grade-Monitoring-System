import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useSchoolData } from "../../context/SchoolDataContext";
import { useToast } from "../../context/ToastContext";
import {
  getActivitiesByAssignment,
  getSubjectAssignmentsByTeacher,
} from "../../services/schoolDataService";

const summaryCards = [
  {
    key: "subjects",
    label: "Teaching Subjects",
    description: "Assigned subjects",
    icon: BookOpen,
    accent: "blue",
    href: "/teacher/classes",
  },
  {
    key: "classes",
    label: "Active Classes",
    description: "Class sections",
    icon: Users,
    accent: "yellow",
    href: "/teacher/classes",
  },
  {
    key: "students",
    label: "Total Students",
    description: "Enrolled learners",
    icon: GraduationCap,
    accent: "red",
    href: "/teacher/classes",
  },
  {
    key: "activities",
    label: "Total Activities",
    description: "Learning activities",
    icon: Activity,
    accent: "blue",
    href: "/teacher/activities",
  },
  {
    key: "records",
    label: "Grade Records",
    description: "Scores recorded",
    icon: ClipboardCheck,
    accent: "red",
    href: "/teacher/scores",
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

function TeacherDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { classes, activities: contextActivities, scores } = useSchoolData();

  const [assignments, setAssignments] = useState([]);
  const [teacherActivities, setTeacherActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) return;

    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const data = await getSubjectAssignmentsByTeacher(user._id);
        const assignmentList = data || [];

        if (!isMounted) return;
        setAssignments(assignmentList);

        // Fetch activities across all subject assignments
        const activityResults = await Promise.all(
          assignmentList.map((assignmentItem) =>
            getActivitiesByAssignment(assignmentItem._id)
              .then((items) =>
                (items || []).map((activity) => ({
                  ...activity,
                  subjectAssignmentId: assignmentItem._id,
                  subject: assignmentItem.subject,
                  className: assignmentItem.class?.name,
                  section: assignmentItem.class?.section,
                }))
              )
              .catch(() => [])
          )
        );

        let flattenedActivities = activityResults.flat();

        // Fallback to school context activities if assignment endpoint returned none
        if (flattenedActivities.length === 0 && contextActivities?.length > 0) {
          const teacherAssignmentIds = new Set(
            assignmentList.map((a) => String(a._id))
          );
          const teacherClassIds = new Set(
            assignmentList.map((a) =>
              String(a.class?._id || a.class?.id || a.class)
            )
          );

          flattenedActivities = contextActivities
            .filter((act) => {
              const actAssignId = String(
                act.subjectAssignmentId ||
                  act.subjectAssignment?._id ||
                  act.subjectAssignment ||
                  ""
              );
              const actClassId = String(
                act.classId || act.class?._id || act.class || ""
              );
              return (
                (actAssignId && teacherAssignmentIds.has(actAssignId)) ||
                (actClassId && teacherClassIds.has(actClassId))
              );
            })
            .map((item) => {
              const matchedAssign = assignmentList.find(
                (a) =>
                  String(a._id) ===
                    String(
                      item.subjectAssignmentId ||
                        item.subjectAssignment?._id ||
                        item.subjectAssignment
                    ) ||
                  String(a.class?._id || a.class?.id || a.class) ===
                    String(item.classId || item.class?._id || item.class)
              );
              return {
                ...item,
                subjectAssignmentId:
                  matchedAssign?._id ||
                  item.subjectAssignmentId ||
                  item.subjectAssignment,
                subject: matchedAssign?.subject || item.subject,
                className: matchedAssign?.class?.name || item.class?.name,
                section: matchedAssign?.class?.section || item.class?.section,
              };
            });
        }

        flattenedActivities.sort(
          (a, b) =>
            new Date(b.date || b.createdAt || 0) -
            new Date(a.date || a.createdAt || 0)
        );

        if (isMounted) {
          setTeacherActivities(flattenedActivities);
        }
      } catch (error) {
        if (isMounted) {
          showToast(
            error.message || "Unable to load teaching assignments.",
            "error"
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user?._id, showToast, contextActivities]);

  // Distinct classes count
  const distinctClassCount = useMemo(() => {
    const classIds = new Set(
      assignments.map((a) => String(a.class?._id || a.class?.id || a.class)).filter(Boolean)
    );
    return classIds.size;
  }, [assignments]);

  // Deduplicated student count
  const totalStudents = useMemo(() => {
    const studentIds = new Set();
    assignments.forEach((a) => {
      (a.class?.students || []).forEach((student) => {
        const id = student?._id || student?.id || student;
        if (id) studentIds.add(String(id));
      });
    });
    return studentIds.size;
  }, [assignments]);

  // Teacher-related scores count
  const teacherScores = useMemo(() => {
    const teacherActivityIdSet = new Set(
      teacherActivities.map((act) => String(act._id || act.id))
    );
    const teacherAssignmentIdSet = new Set(
      assignments.map((a) => String(a._id))
    );
    const teacherClassIdSet = new Set(
      assignments.map((a) => String(a.class?._id || a.class?.id || a.class))
    );

    return (scores || []).filter((scoreItem) => {
      const actId = String(
        scoreItem.activityId ||
          scoreItem.activity?._id ||
          scoreItem.activity ||
          ""
      );
      const assignId = String(
        scoreItem.subjectAssignment?._id ||
          scoreItem.subjectAssignment ||
          ""
      );
      const clsId = String(
        scoreItem.classId || scoreItem.class?._id || scoreItem.class || ""
      );

      return (
        (actId && teacherActivityIdSet.has(actId)) ||
        (assignId && teacherAssignmentIdSet.has(assignId)) ||
        (clsId && teacherClassIdSet.has(clsId))
      );
    });
  }, [teacherActivities, assignments, scores]);

  const totals = {
    subjects: assignments.length,
    classes: distinctClassCount,
    students: totalStudents,
    activities: teacherActivities.length,
    records: teacherScores.length,
  };

  const getClassName = (classId) =>
    classes.find((classItem) => String(classItem.id || classItem._id) === String(classId))?.name ||
    assignments.find(
      (a) => String(a.class?._id || a.class?.id || a.class) === String(classId)
    )?.class?.name ||
    "Unknown class";

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-xl bg-blue-700 px-6 py-7 text-white shadow-sm sm:px-8">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-18 border-yellow-400/80" />
        <div className="absolute bottom-0 right-24 h-2 w-20 bg-red-500" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            DNHS-SGMS Faculty Portal
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Teacher Dashboard
          </h1>
          <p className="mt-2 text-sm text-blue-100 sm:text-base">
            Welcome, {user?.name}. Monitor your assigned classes, learning activities, and
            grade records in one place.
          </p>
        </div>
      </section>

      {/* Summary Cards */}
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
                    {loading ? "..." : totals[card.key]}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {card.description}
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

      {/* Two-Column Overview */}
      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        {/* Class Overview */}
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

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading class assignments...
            </div>
          ) : assignments.length > 0 ? (
            <div className="divide-y">
              {assignments.map((assignment) => {
                const cls = assignment.class || {};
                const studentCount = cls.students?.length || 0;

                return (
                  <div
                    key={assignment._id}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-gray-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {cls.name || "Class"} · {assignment.subject}
                        </p>
                        {cls.section && (
                          <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            Sec {cls.section}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Grade {cls.gradeLevel || "—"} · {cls.schoolYear || "S.Y."}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {studentCount} {studentCount === 1 ? "student" : "students"}
                      </div>
                      <Link
                        to={`/teacher/activities?assignmentId=${assignment._id}`}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-xs transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
                      >
                        Activities
                      </Link>
                      <Link
                        to={`/teacher/scores?assignmentId=${assignment._id}`}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 hover:text-blue-800"
                      >
                        Scores
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No classes or subject assignments available yet." />
          )}

          {assignments.length > 5 && (
            <div className="border-t bg-gray-50/40 px-5 py-3">
              <Link
                to="/teacher/classes"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all {assignments.length} assigned classes &amp; subjects
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activities */}
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

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading recent activities...
            </div>
          ) : teacherActivities.length > 0 ? (
            <div className="divide-y">
              {teacherActivities.slice(0, 5).map((activity) => {
                const classLabel =
                  activity.className ||
                  getClassName(activity.classId || activity.class);
                const subLabel = [
                  classLabel,
                  activity.subject,
                  activity.type?.replaceAll("_", " "),
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <Link
                    key={activity.id || activity._id}
                    to={`/teacher/scores?assignmentId=${
                      activity.subjectAssignmentId ||
                      activity.subjectAssignment
                    }&activityId=${activity.id || activity._id}`}
                    className="group flex gap-3 px-5 py-4 transition hover:bg-gray-50/70"
                  >
                    <div className="mt-0.5 rounded-md bg-red-50 p-2 text-red-600 transition-colors group-hover:bg-red-100">
                      <Activity size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                        {activity.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {subLabel}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-gray-400">
                      {activity.date
                        ? String(activity.date).slice(0, 10)
                        : "Recent"}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No activities available yet." />
          )}

          {teacherActivities.length > 5 && (
            <div className="border-t bg-gray-50/40 px-5 py-3">
              <Link
                to="/teacher/activities"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all {teacherActivities.length} activities
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Grade Performance Overview Banner */}
      <section className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 text-blue-700">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-blue-700">
              Grade Performance Overview
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {teacherScores.length > 0
                ? `${teacherScores.length} grade record${
                    teacherScores.length === 1 ? "" : "s"
                  } are available for review.`
                : "No grade records available yet."}
            </p>
          </div>
        </div>
        <Link
          to="/teacher/scores"
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

export default TeacherDashboard;
