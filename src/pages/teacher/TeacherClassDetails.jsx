import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  BookOpen,
  ClipboardList,
  UserPlus,
  BarChart3,
  Search,
  X,
  ChevronRight,
  Eye,
  Calendar,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getClassById,
  getSubjectAssignmentsByTeacher,
  getActivitiesByClass,
} from "../../services/schoolDataService";
import StudentInviteManager from "../../components/classes/StudentInviteManager";

export default function TeacherClassDetails() {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [classData, setClassData] = useState(null);
  const [loadingClass, setLoadingClass] = useState(true);

  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // Student roster search
  const [studentSearch, setStudentSearch] = useState("");

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Load class information
  const loadClass = async () => {
    if (!classId) return;
    try {
      setLoadingClass(true);
      const data = await getClassById(classId);
      setClassData(data);
    } catch (err) {
      console.error("Failed to load class details:", err);
      showToast(err.message || "Failed to load class details.", "error");
    } finally {
      setLoadingClass(false);
    }
  };

  // Load teacher's subjects for this class
  const loadAssignments = async () => {
    if (!user?._id || !classId) return;
    try {
      setLoadingAssignments(true);
      const data = await getSubjectAssignmentsByTeacher(user._id);
      const matching = (data || []).filter(
        (item) => String(item.class?._id || item.class?.id || item.class) === String(classId)
      );
      setAssignments(matching);
    } catch (err) {
      console.error("Failed to load subject assignments:", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // Load class activities
  const loadActivities = async () => {
    if (!classId) return;
    try {
      setLoadingActivities(true);
      const data = await getActivitiesByClass(classId);
      setActivities(data || []);
    } catch (err) {
      console.error("Failed to load class activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    loadClass();
    loadAssignments();
    loadActivities();
  }, [classId, user?._id]);

  const students = classData?.students || [];

  // Filter students by query
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  if (loadingClass) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        Loading class details...
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/teacher/classes")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={15} />
          Back to My Classes
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <GraduationCap size={44} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-xl font-bold text-gray-800">Class Not Found</h2>
          <p className="mt-1 text-sm text-gray-500">
            The requested class could not be loaded or is not accessible.
          </p>
          <button
            type="button"
            onClick={() => navigate("/teacher/classes")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Return to My Classes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================================================
          BREADCRUMB & HEADER ACTION BAR
      ================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/teacher/classes")}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-800"
          >
            <ArrowLeft size={15} />
            Back to My Classes
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {classData.name}
            </h1>
            <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              Grade {classData.gradeLevel}
            </span>
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
              Section {classData.section}
            </span>
            <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              S.Y. {classData.schoolYear}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
          >
            <UserPlus size={15} />
            Invite Students
          </button>

          <button
            type="button"
            onClick={() => navigate(`/teacher/scores?classId=${classId}`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <BarChart3 size={15} />
            Scores &amp; Gradebook
          </button>
        </div>
      </div>

      {/* ==================================================
          KPI METRIC SUMMARY CARDS
      ================================================== */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600">
            <Users size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Enrolled Students
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{students.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-purple-600">
            <BookOpen size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              My Subjects
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{assignments.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-green-600">
            <ClipboardList size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Class Activities
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{activities.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600">
            <Calendar size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Cohort
            </span>
          </div>
          <p className="mt-2 text-base font-bold text-gray-900 truncate">
            Grade {classData.gradeLevel} · {classData.section}
          </p>
        </div>
      </section>

      {/* ==================================================
          ASSIGNED SUBJECTS CARDS
      ================================================== */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">
              Your Teaching Subjects in this Class
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Subject components and direct grading access.
          </p>
        </div>

        {loadingAssignments ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading subjects...</div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <BookOpen size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700">No subjects assigned to you in this class</p>
            <p className="text-xs text-gray-400 mt-1">
              Ask your administrator to assign you as the subject teacher for this section.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {assignments.map((item) => {
              const components = item.gradingSystem?.components || [];

              return (
                <div
                  key={item._id}
                  className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow"
                >
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{item.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Teacher: <span className="font-semibold text-gray-800">{user?.name}</span>
                    </p>

                    {/* Component breakdown */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {components.map((c) => (
                        <span
                          key={c.key}
                          className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                        >
                          {c.key === "written_work"
                            ? "Written"
                            : c.key === "performance_task"
                            ? "Perf."
                            : "Assess."}{" "}
                          {c.percentage}%
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-semibold text-blue-600">
                    <Link
                      to={`/teacher/activities?assignmentId=${item._id}`}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <ClipboardList size={13} /> Activities
                    </Link>
                    <Link
                      to={`/teacher/scores?classId=${classId}&assignmentId=${item._id}&tab=scores`}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <BarChart3 size={13} /> Scores &amp; Grades
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================================================
          ENROLLED STUDENTS ROSTER
      ================================================== */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Enrolled Students Roster</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {students.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Students enrolled in Grade {classData.gradeLevel} - {classData.section}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Student Search */}
            <div className="relative w-full sm:w-60">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-7 text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <UserPlus size={14} />
              Invite Students
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3">Student Name</th>
                <th className="px-5 py-3">Student ID (LRN)</th>
                <th className="px-5 py-3">Email Address</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student, index) => {
                const studentId = student._id || student.id;

                return (
                  <tr key={studentId || index} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {student.name ? student.name[0].toUpperCase() : "S"}
                        </div>
                        <span className="font-semibold text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-600">
                      {student.studentId || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{student.email || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/teacher/scores?classId=${classId}&studentId=${studentId}&tab=gradebook`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                      >
                        <Eye size={13} />
                        View Progress
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {students.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-10 text-center text-sm text-gray-500">
                    <Users size={36} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-semibold text-gray-700">No students enrolled yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Invite registered Grade {classData.gradeLevel} students to join this class roster.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <UserPlus size={14} /> Invite Students Now
                    </button>
                  </td>
                </tr>
              )}

              {students.length > 0 && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-8 text-center text-sm text-gray-500">
                    No students match &quot;{studentSearch}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================
          CLASS ACTIVITIES PREVIEW
      ================================================== */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Class Activities</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {activities.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Activities created for this class across all subjects.
            </p>
          </div>

          <Link
            to={`/teacher/activities?classId=${classId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
          >
            Manage Activities
            <ChevronRight size={14} />
          </Link>
        </div>

        {loadingActivities ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading activities...</div>
        ) : activities.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {activities.slice(0, 5).map((activity) => (
              <Link
                key={activity._id}
                to={`/teacher/scores?assignmentId=${
                  activity.subjectAssignment?._id || activity.subjectAssignment || ""
                }&activityId=${activity._id}`}
                className="flex items-center justify-between p-4 transition hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ClipboardList size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{activity.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                        {activity.subjectAssignment?.subject || "Subject"}
                      </span>
                      <span>·</span>
                      <span>Due {activity.date ? new Date(activity.date).toLocaleDateString() : "—"}</span>
                      <span>·</span>
                      <span className="font-semibold text-gray-700">{activity.totalPoints || 0} pts</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      activity.status === "locked"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {activity.status === "locked" ? "Locked" : "Active"}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-500">
            <ClipboardList size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700">No activities recorded yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create activities to record scores and compute grades.
            </p>
          </div>
        )}
      </section>

      {/* ==================================================
          TEACHER INVITE STUDENTS MODAL
      ================================================== */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInviteModal(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Invite Students</h2>
                <p className="text-xs text-gray-500">
                  {classData.name} · Section {classData.section} (Grade {classData.gradeLevel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <StudentInviteManager
                classData={classData}
                isTeacher={true}
                teacherUserId={user?._id}
                onClose={() => setShowInviteModal(false)}
                onSuccess={async () => {
                  await loadClass();
                  setShowInviteModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
