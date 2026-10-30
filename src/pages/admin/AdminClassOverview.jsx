import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Users,
  BookOpen,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  UserRoundPen,
} from "lucide-react";

import { useSchoolData } from "../../context/SchoolDataContext";
import {
  createSubjectAssignment,
  getActivitiesByClass,
  getSubjectAssignmentsByClass,
  getTeachers,
  removeStudentFromClass,
} from "../../services/schoolDataService";
import { useToast } from "../../context/ToastContext";
import StudentInviteManager from "../../components/classes/StudentInviteManager";

function AdminClassOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { classes, loading, reloadData } = useSchoolData();

  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    subject: "",
    teacherUserId: "",
    writtenWork: "30",
    performanceTask: "50",
    assessment: "20",
  });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [openStudentMenuId, setOpenStudentMenuId] = useState(null);

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

  useEffect(() => {
    if (!id) return;
    setAssignmentsLoaded(false);
    setAssignments([]);
    Promise.all([getSubjectAssignmentsByClass(id), getTeachers()])
      .then(([assignmentData, teacherData]) => {
        setAssignments(assignmentData || []);
        setTeachers(teacherData || []);
      })
      .catch((loadError) => showToast(loadError.message || "Unable to load subject assignments.", "error"))
      .finally(() => setAssignmentsLoaded(true));
  }, [id, showToast]);

  const handleCreateAssignment = async (event) => {
    event.preventDefault();
    const values = [
      Number(assignmentForm.writtenWork),
      Number(assignmentForm.performanceTask),
      Number(assignmentForm.assessment),
    ];
    if (!assignmentForm.subject.trim() || !assignmentForm.teacherUserId) {
      showToast("Enter a subject and select its teacher.", "warning");
      return;
    }
    if (values.reduce((sum, value) => sum + value, 0) !== 100) {
      showToast("The subject grading weights must total 100%.", "warning");
      return;
    }
    try {
      setSavingAssignment(true);
      const created = await createSubjectAssignment({
        classId: id,
        subject: assignmentForm.subject.trim(),
        teacherUserId: assignmentForm.teacherUserId,
        gradingSystem: {
          enabled: true,
          components: [
            { key: "written_work", name: "Written Work", percentage: values[0] },
            { key: "performance_task", name: "Performance Tasks", percentage: values[1] },
            { key: "assessment", name: "Assessment", percentage: values[2] },
          ],
        },
      });
      setAssignments((current) => [created, ...current]);
      setAssignmentForm({ subject: "", teacherUserId: "", writtenWork: "30", performanceTask: "50", assessment: "20" });
      setShowAssignmentModal(false);
      showToast("Subject and teacher assigned to the class.", "success");
    } catch (saveError) {
      showToast(saveError.message || "Unable to create subject assignment.", "error");
    } finally {
      setSavingAssignment(false);
    }
  };

  if (!selectedClass) {
    if (loading) {
      return (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Loading class...
        </div>
      );
    }

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
  const needsSetup = assignmentsLoaded && !loadingActivities && (assignments.length === 0 || students.length === 0);

  const handleRemoveStudent = async (student) => {
    if (!window.confirm(`Remove ${student.name} from ${selectedClass.name}?`)) return;
    try {
      await removeStudentFromClass(student._id || student.id, id);
      showToast(`${student.name} was removed from the class.`, "success");
      await reloadData();
    } catch (removeError) {
      showToast(removeError.message || "Unable to remove student from class.", "error");
    }
  };

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
        <div className="grid gap-4 bg-blue-700 p-5 text-white sm:grid-cols-3 sm:p-6">
          <MetricItem icon={<Users size={20} />} label="Total Students" value={students.length} />
          <MetricItem icon={<BookOpen size={20} />} label="Assigned Subjects" value={assignments.length} />
          <MetricItem icon={<ClipboardList size={20} />} label="Total Activities" value={activities.length} />
        </div>
      </section>

      {(!needsSetup || assignments.length > 0) && <section className="flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Subject and teacher assignment</h2>
          <p className="mt-1 text-sm text-gray-500">Assign a subject, teacher, and grading configuration to this class.</p>
        </div>
        <button type="button" onClick={() => setShowAssignmentModal(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={17} /> Assign Subject and Teacher
        </button>
      </section>}

      {assignments.length > 0 && <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-gray-900">Teachers and subjects</h2>
          <p className="mt-1 text-sm text-gray-500">Manage activities and scores for each subject separately.</p>
        </div>
        {assignments.length ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {assignments.map((assignment) => (
              <article key={assignment._id} className="flex min-h-40 flex-col rounded-xl border border-gray-200 p-4">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{assignment.subject}</p>
                  <p className="mt-1 text-sm text-gray-600">{assignment.teacher?.name || "No teacher assigned"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(assignment.gradingSystem?.components || []).map((component) => (
                      <span key={component.key} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {component.key === "written_work" ? "Written" : component.key === "performance_task" ? "Performance" : "Assessment"} {component.percentage}%
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-4 border-t pt-3 text-sm font-medium text-blue-600">
                  <Link to={`/admin/activities?assignmentId=${assignment._id}`}>Activities</Link>
                  <Link to={`/admin/scores?assignmentId=${assignment._id}`}>Scores</Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>}

      {needsSetup && <section className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Getting started</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">Set up this class</h2>
        <p className="mt-1 text-sm text-gray-500">Complete these steps to prepare the class for teaching.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-5">
            <span className={`text-xs font-semibold uppercase ${assignments.length ? "text-green-700" : "text-blue-600"}`}>Step 1 {assignments.length ? "· Complete" : "· Next"}</span>
            <h3 className="mt-2 font-semibold text-gray-900">Assign a subject and teacher</h3>
            <p className="mt-1 text-sm text-gray-500">Set the subject grading configuration for this class.</p>
            <button type="button" onClick={() => setShowAssignmentModal(true)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Assign Subject &amp; Teacher</button>
          </div>
          <div className="rounded-xl border p-5">
            <span className={`text-xs font-semibold uppercase ${students.length ? "text-green-700" : "text-blue-600"}`}>Step 2 {students.length ? "· Complete" : "· Next"}</span>
            <h3 className="mt-2 font-semibold text-gray-900">Enroll students</h3>
            <p className="mt-1 text-sm text-gray-500">Invite students to join this class.</p>
            <button type="button" onClick={() => setShowInviteModal(true)} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Enroll Students</button>
          </div>
        </div>
      </section>}

      {showAssignmentModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingAssignment) setShowAssignmentModal(false); }}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div><h2 className="font-semibold text-gray-900">Assign subject and teacher</h2><p className="text-sm text-gray-500">{selectedClass.name} · Section {selectedClass.section}</p></div>
            <button type="button" onClick={() => setShowAssignmentModal(false)} className="rounded-md px-3 py-1 text-sm text-gray-500 hover:bg-gray-100">Close</button>
          </div>
          <form onSubmit={handleCreateAssignment} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Subject
            <input
              value={assignmentForm.subject}
              onChange={(event) => setAssignmentForm((form) => ({ ...form, subject: event.target.value }))}
              placeholder="e.g. Mathematics"
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 font-normal"
              required
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Teacher
            <select
              value={assignmentForm.teacherUserId}
              onChange={(event) => setAssignmentForm((form) => ({ ...form, teacherUserId: event.target.value }))}
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 font-normal"
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-sm font-medium text-gray-700">Subject grading weights</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["writtenWork", "Written Work"],
                ["performanceTask", "Performance Tasks"],
                ["assessment", "Assessment"],
              ].map(([key, label]) => (
                <label key={key} className="text-xs text-gray-500">
                  {label} (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={assignmentForm[key]}
                    onChange={(event) => setAssignmentForm((form) => ({ ...form, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={savingAssignment} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Plus size={17} /> {savingAssignment ? "Assigning…" : "Assign Subject and Teacher"}
            </button>
          </div>
          </form>
        </div>
      </div>}

      {/* =========================
          RECENT ACTIVITIES
      ========================== */}

      {(activities.length > 0 || !needsSetup) && <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
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
                to={`/admin/scores?assignmentId=${activity.subjectAssignment?._id || activity.subjectAssignment || ""}&activityId=${activity._id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50"
              >
                <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                  <ClipboardList size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {activity.title}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{activity.subjectAssignment?.subject || "Subject"}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Due {activity.date ? new Date(activity.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{activity.totalPoints || 0} pts</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${activity.status === "locked" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{activity.status === "locked" ? "Locked" : "Active"}</span>
                  </div>
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
      </section>}

      {(students.length > 0 || !needsSetup) && <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Users size={20} className="text-blue-600" />
          <div>
            <h2 className="text-lg font-bold text-blue-700">
              Students
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Student ID</th><th className="px-5 py-3">Email</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y">
              {students.map((student, index) => {
                const studentId = student._id || student.id;
                return <tr key={studentId || index}>
                  <td className="px-5 py-4 text-sm font-medium text-gray-800">{student.name}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{student.studentId || "—"}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{student.email || "—"}</td>
                  <td className="relative px-5 py-4 text-right">
                    <button type="button" aria-label={`Actions for ${student.name}`} onClick={() => setOpenStudentMenuId(openStudentMenuId === studentId ? null : studentId)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><MoreHorizontal size={18} /></button>
                    {openStudentMenuId === studentId && <div className="absolute right-5 top-12 z-20 w-48 rounded-lg border bg-white py-1 text-left shadow-lg">
                      <Link to={`/admin/accounts/student/${studentId}/edit`} onClick={() => setOpenStudentMenuId(null)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><UserRoundPen size={15} /> Edit student</Link>
                      <Link to={`/admin/scores?classId=${id}&studentId=${studentId}&tab=gradebook`} onClick={() => setOpenStudentMenuId(null)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Eye size={15} /> View progress</Link>
                      <button type="button" onClick={() => { setOpenStudentMenuId(null); handleRemoveStudent(student); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={15} /> Remove from class</button>
                    </div>}
                  </td>
                </tr>;
              })}
              {students.length === 0 && <tr><td colSpan="4" className="px-5 py-10 text-center text-sm text-gray-500">No students in this class yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
      {showInviteModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInviteModal(false); }}>
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4"><div><h2 className="text-lg font-semibold text-gray-900">Enroll Students</h2><p className="text-sm text-gray-500">{selectedClass.name} · Section {selectedClass.section}</p></div><button type="button" onClick={() => setShowInviteModal(false)} className="rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">Close</button></div>
          <div className="p-6"><StudentInviteManager classData={selectedClass} isTeacher={false} onClose={() => setShowInviteModal(false)} onSuccess={async () => { await reloadData(); setShowInviteModal(false); }} /></div>
        </div>
      </div>}
    </div>
  );
}

function MetricItem({ icon, label, value }) {
  return <div className="flex items-center gap-3 rounded-lg bg-white/10 p-4"><div className="rounded-lg bg-white/15 p-2 text-white">{icon}</div><div><p className="text-xs font-medium uppercase tracking-wide text-blue-100">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div></div>;
}

export default AdminClassOverview;
