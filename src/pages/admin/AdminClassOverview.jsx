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
  UserPlus,
  Search,
  X,
  GraduationCap,
  Sparkles,
  BarChart3,
  Calendar,
} from "lucide-react";

import { useSchoolData } from "../../context/SchoolDataContext";
import {
  createSubjectAssignment,
  deleteSubjectAssignment,
  getActivitiesByClass,
  getClassById,
  getSubjectAssignmentsByClass,
  getTeachers,
  removeStudentFromClass,
} from "../../services/schoolDataService";
import { useToast } from "../../context/ToastContext";
import StudentInviteManager from "../../components/classes/StudentInviteManager";

export default function AdminClassOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { classes, loading: loadingContext, reloadData } = useSchoolData();

  const [directClass, setDirectClass] = useState(null);
  const [loadingClass, setLoadingClass] = useState(false);

  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState("");

  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    subject: "",
    teacherUserId: "",
    writtenWork: "30",
    performanceTask: "50",
    assessment: "20",
  });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [openStudentMenuId, setOpenStudentMenuId] = useState(null);

  // Student search within class
  const [studentSearch, setStudentSearch] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside() {
      setOpenStudentMenuId(null);
    }
    if (openStudentMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openStudentMenuId]);

  // Find class from context or fallback to direct fetch
  const selectedClass = useMemo(() => {
    return (
      classes.find(
        (c) => String(c._id || c.id) === String(id)
      ) || directClass
    );
  }, [classes, directClass, id]);

  // Load single class if context didn't have it yet
  useEffect(() => {
    if (!id) return;
    const fromContext = classes.find((c) => String(c._id || c.id) === String(id));
    if (!fromContext) {
      setLoadingClass(true);
      getClassById(id)
        .then((data) => setDirectClass(data))
        .catch((err) => console.error("Failed to fetch class directly:", err))
        .finally(() => setLoadingClass(false));
    }
  }, [id, classes]);

  // Load class activities
  useEffect(() => {
    if (!id) return;
    const loadActivities = async () => {
      try {
        setLoadingActivities(true);
        setError("");
        const data = await getActivitiesByClass(id);
        setActivities(data || []);
      } catch (err) {
        console.error("Failed to load class activities:", err);
        setError(err.message || "Failed to load class activities.");
      } finally {
        setLoadingActivities(false);
      }
    };

    loadActivities();
  }, [id]);

  // Load subject assignments and teacher roster
  useEffect(() => {
    if (!id) return;
    setAssignmentsLoaded(false);
    Promise.all([getSubjectAssignmentsByClass(id), getTeachers()])
      .then(([assignmentData, teacherData]) => {
        setAssignments(assignmentData || []);
        setTeachers(teacherData || []);
      })
      .catch((loadError) =>
        showToast(loadError.message || "Unable to load subject assignments.", "error")
      )
      .finally(() => setAssignmentsLoaded(true));
  }, [id, showToast]);

  // Create subject assignment
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
      setAssignmentForm({
        subject: "",
        teacherUserId: "",
        writtenWork: "30",
        performanceTask: "50",
        assessment: "20",
      });
      setShowAssignmentModal(false);
      showToast("Subject and teacher assigned to the class.", "success");
    } catch (saveError) {
      showToast(saveError.message || "Unable to create subject assignment.", "error");
    } finally {
      setSavingAssignment(false);
    }
  };

  // Delete subject assignment
  const handleDeleteAssignment = async (assignment) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${assignment.subject}" from this class? Existing grades and activities for this assignment may become unlinked.`
      )
    ) {
      return;
    }

    try {
      setDeletingAssignmentId(assignment._id);
      await deleteSubjectAssignment(assignment._id);
      setAssignments((prev) => prev.filter((a) => a._id !== assignment._id));
      showToast(`Subject "${assignment.subject}" removed.`, "success");
    } catch (err) {
      showToast(err.message || "Unable to remove subject assignment.", "error");
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  // Remove student from class
  const handleRemoveStudent = async (student) => {
    if (!window.confirm(`Remove ${student.name} from ${selectedClass.name}?`)) return;
    try {
      const studentId = student._id || student.id;
      await removeStudentFromClass(studentId, id);
      showToast(`${student.name} was removed from the class.`, "success");
      await reloadData();
      if (directClass) {
        const refreshed = await getClassById(id);
        setDirectClass(refreshed);
      }
    } catch (removeError) {
      showToast(removeError.message || "Unable to remove student from class.", "error");
    }
  };

  if (!selectedClass) {
    if (loadingContext || loadingClass) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          Loading class overview...
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/admin/classes")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Classes
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <GraduationCap size={44} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-xl font-bold text-gray-800">Class Not Found</h2>
          <p className="mt-1 text-sm text-gray-500">
            The requested class could not be found or has been removed.
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/classes")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Return to Class List
          </button>
        </div>
      </div>
    );
  }

  const students = selectedClass.students || [];

  // Filter students by search
  const filteredStudents = students.filter((student) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.trim().toLowerCase();
    return (
      student.name?.toLowerCase().includes(q) ||
      student.studentId?.toLowerCase().includes(q) ||
      student.email?.toLowerCase().includes(q)
    );
  });

  const needsSetup =
    assignmentsLoaded && !loadingActivities && (assignments.length === 0 || students.length === 0);

  return (
    <div className="space-y-6">
      {/* ==================================================
          BREADCRUMB & HEADER ACTION BAR
      ================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/admin/classes")}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-800"
          >
            <ArrowLeft size={15} />
            Back to Classes
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {selectedClass.name}
            </h1>
            <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              Grade {selectedClass.gradeLevel}
            </span>
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
              Section {selectedClass.section}
            </span>
            <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              S.Y. {selectedClass.schoolYear}
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
            Enroll Students
          </button>

          <button
            type="button"
            onClick={() => setShowAssignmentModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
          >
            <Plus size={15} />
            Assign Subject
          </button>

          <button
            type="button"
            onClick={() => navigate(`/admin/scores?classId=${id}&tab=gradebook`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <BarChart3 size={15} />
            View Gradebook
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
              Assigned Subjects
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
              Academic Cohort
            </span>
          </div>
          <p className="mt-2 text-base font-bold text-gray-900 truncate">
            Grade {selectedClass.gradeLevel} · {selectedClass.section}
          </p>
        </div>
      </section>

      {/* ==================================================
          SETUP GUIDE (ONBOARDING IF INCOMPLETE)
      ================================================== */}
      {needsSetup && (
        <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
            <Sparkles size={16} />
            Getting Started Setup Guide
          </div>
          <h2 className="mt-1 text-lg font-bold text-gray-900">
            Complete Setup for {selectedClass.name}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Follow these essential steps to make this class ready for teachers, activities, and grading.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div
              className={`rounded-xl border p-4 transition ${
                assignments.length > 0 ? "border-green-300 bg-green-50/30" : "border-blue-200 bg-white"
              }`}
            >
              <span
                className={`text-xs font-bold uppercase ${
                  assignments.length > 0 ? "text-green-700" : "text-blue-600"
                }`}
              >
                Step 1 {assignments.length > 0 ? "· Completed ✓" : "· Next Step"}
              </span>
              <h3 className="mt-1 font-semibold text-gray-900">Assign Subject &amp; Teacher</h3>
              <p className="mt-1 text-xs text-gray-500">
                Define the subjects taught in this section and assign faculty members with grading weights.
              </p>
              <button
                type="button"
                onClick={() => setShowAssignmentModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={14} /> Assign Subject
              </button>
            </div>

            <div
              className={`rounded-xl border p-4 transition ${
                students.length > 0 ? "border-green-300 bg-green-50/30" : "border-blue-200 bg-white"
              }`}
            >
              <span
                className={`text-xs font-bold uppercase ${
                  students.length > 0 ? "text-green-700" : "text-blue-600"
                }`}
              >
                Step 2 {students.length > 0 ? "· Completed ✓" : "· Next Step"}
              </span>
              <h3 className="mt-1 font-semibold text-gray-900">Enroll Students</h3>
              <p className="mt-1 text-xs text-gray-500">
                Invite registered Grade {selectedClass.gradeLevel} learners to this class section.
              </p>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <UserPlus size={14} /> Enroll Students
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================
          SUBJECTS & TEACHERS SECTION
      ================================================== */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">
                Subjects &amp; Faculty Assignments
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {assignments.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Each subject has its own teacher and DepEd-compliant grading components.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAssignmentModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={15} />
            Assign Subject
          </button>
        </div>

        {assignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <BookOpen size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700">No subjects assigned to this class yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Assign subjects like Mathematics, English, or Science to configure teaching and grading.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {assignments.map((assignment) => {
              const components = assignment.gradingSystem?.components || [];
              const isDeleting = deletingAssignmentId === assignment._id;

              return (
                <div
                  key={assignment._id}
                  className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{assignment.subject}</h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Faculty:{" "}
                          <strong className="text-gray-900 font-semibold">
                            {assignment.teacher?.name || "Unassigned"}
                          </strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(assignment)}
                        disabled={isDeleting}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Remove Subject"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Component Pills */}
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
                      to={`/admin/activities?assignmentId=${assignment._id}`}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <ClipboardList size={13} /> Activities
                    </Link>
                    <Link
                      to={`/admin/scores?assignmentId=${assignment._id}`}
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
          STUDENTS ROSTER SECTION
      ================================================== */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Enrolled Students</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {students.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Official student roster for Section {selectedClass.section}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search within class */}
            <div className="relative w-full sm:w-60">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                maxLength={100}
                placeholder="Search student roster..."
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
              Enroll Students
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
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
                const isMenuOpen = openStudentMenuId === studentId;

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
                    <td className="relative px-5 py-3.5 text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${student.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenStudentMenuId(isMenuOpen ? null : studentId);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <MoreHorizontal size={17} />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-5 top-11 z-30 w-52 rounded-xl border border-gray-200 bg-white py-1.5 text-left shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to={`/admin/scores?classId=${id}&studentId=${studentId}&tab=gradebook`}
                            onClick={() => setOpenStudentMenuId(null)}
                            className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Eye size={14} className="text-blue-600" />
                            View Student Progress
                          </Link>
                          <Link
                            to={`/admin/accounts/student/${studentId}/edit`}
                            onClick={() => setOpenStudentMenuId(null)}
                            className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <UserRoundPen size={14} className="text-gray-500" />
                            Edit Student Account
                          </Link>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            onClick={() => {
                              setOpenStudentMenuId(null);
                              handleRemoveStudent(student);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} className="text-red-500" />
                            Remove from Class
                          </button>
                        </div>
                      )}
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
                      Click &quot;Enroll Students&quot; to invite registered Grade {selectedClass.gradeLevel} learners.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <UserPlus size={14} /> Enroll Students Now
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
          RECENT ACTIVITIES PREVIEW
      ================================================== */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Class Activities &amp; Assessments</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {activities.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Quizzes, performance tasks, and exams recorded for this class.
            </p>
          </div>

          <Link
            to={`/admin/activities?classId=${selectedClass.id || selectedClass._id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
          >
            View All Activities
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
                to={`/admin/scores?assignmentId=${
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
                        {activity.subjectAssignment?.subject || "General"}
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
              Create an activity to start collecting scores and calculating student grades.
            </p>
          </div>
        )}
      </section>

      {/* ==================================================
          ASSIGN SUBJECT & TEACHER MODAL
      ================================================== */}
      {showAssignmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingAssignment) setShowAssignmentModal(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Assign Subject &amp; Teacher</h2>
                <p className="text-xs text-gray-500">
                  {selectedClass.name} · Section {selectedClass.section}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Subject Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={assignmentForm.subject}
                    onChange={(e) =>
                      setAssignmentForm((f) => ({ ...f, subject: e.target.value }))
                    }
                    minLength={2}
                    maxLength={80}
                    placeholder="e.g. Mathematics, Science, English"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Assigned Teacher <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignmentForm.teacherUserId}
                    onChange={(e) =>
                      setAssignmentForm((f) => ({ ...f, teacherUserId: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Select Faculty Member</option>
                    {teachers.map((teacher) => (
                      <option key={teacher._id} value={teacher._id}>
                        {teacher.name} ({teacher.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grading Weights */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    DepEd Grading Weights
                  </p>
                  <span
                    className={`text-xs font-bold ${
                      Number(assignmentForm.writtenWork) +
                        Number(assignmentForm.performanceTask) +
                        Number(assignmentForm.assessment) ===
                      100
                        ? "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    Total:{" "}
                    {Number(assignmentForm.writtenWork) +
                      Number(assignmentForm.performanceTask) +
                      Number(assignmentForm.assessment)}
                    % / 100%
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ["writtenWork", "Written Work"],
                    ["performanceTask", "Performance Tasks"],
                    ["assessment", "Assessment"],
                  ].map(([key, label]) => (
                    <label key={key} className="text-xs font-semibold text-gray-700">
                      {label} (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        inputMode="numeric"
                        value={assignmentForm[key]}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-", "."].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          setAssignmentForm((f) => ({
                            ...f,
                            [key]: v ? String(Math.min(100, parseInt(v, 10))) : "",
                          }));
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                        required
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  disabled={savingAssignment}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                  {savingAssignment ? "Assigning..." : "Assign Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================
          ENROLL STUDENTS MODAL
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
                <h2 className="text-lg font-bold text-gray-900">Enroll Students</h2>
                <p className="text-xs text-gray-500">
                  {selectedClass.name} · Section {selectedClass.section} (Grade {selectedClass.gradeLevel})
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
                classData={selectedClass}
                isTeacher={false}
                onClose={() => setShowInviteModal(false)}
                onSuccess={async () => {
                  await reloadData();
                  if (directClass) {
                    const refreshed = await getClassById(id);
                    setDirectClass(refreshed);
                  }
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
