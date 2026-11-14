import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Users,
  ClipboardList,
  Search,
  X,
  ChevronRight,
  UserPlus,
  BookOpen,
  Filter,
  RotateCcw,
  BarChart3,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getSubjectAssignmentsByTeacher } from "../../services/schoolDataService";
import StudentInviteManager from "../../components/classes/StudentInviteManager";

export default function TeacherClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  // Invite modal
  const [inviteModalClass, setInviteModalClass] = useState(null);

  const loadAssignments = async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      const data = await getSubjectAssignmentsByTeacher(user._id);
      setAssignments(data || []);
    } catch (error) {
      showToast(error.message || "Unable to load assignments.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [user?._id]);

  // Distinct classes count
  const distinctClassCount = useMemo(() => {
    const classIds = new Set(
      assignments.map((a) => String(a.class?._id || a.class?.id || a.class))
    );
    return classIds.size;
  }, [assignments]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      const cls = item.class || {};
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        [cls.name, cls.section, item.subject, cls.schoolYear]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query));

      const matchesGrade =
        gradeFilter === "all" || String(cls.gradeLevel) === gradeFilter;

      return matchesSearch && matchesGrade;
    });
  }, [assignments, search, gradeFilter]);

  const hasActiveFilters = search.trim() !== "" || gradeFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setGradeFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* ==================================================
          PAGE HEADER
      ================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              My Classes &amp; Subjects
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {assignments.length} {assignments.length === 1 ? "Subject" : "Subjects"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            View your assigned teaching subjects, class rosters, activities, and grading sheets.
          </p>
        </div>
      </div>

      {/* ==================================================
          FACULTY KPI METRICS
      ================================================== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600">
            <BookOpen size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Teaching Subjects
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{assignments.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-purple-600">
            <GraduationCap size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active Classes
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{distinctClassCount}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600">
            <Users size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Faculty Profile
            </span>
          </div>
          <p className="mt-2 text-base font-bold text-gray-900 truncate">
            {user?.name || "Teacher"}
          </p>
        </div>
      </div>

      {/* ==================================================
          SEARCH & FILTER TOOLBAR
      ================================================== */}
      {assignments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by class name, section, or subject..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Grade Filter */}
            <div className="w-full sm:w-44">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Grades</option>
                {[7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================
          CLASS ASSIGNMENTS GRID
      ================================================== */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          Loading assigned classes...
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
          <GraduationCap size={44} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-lg font-bold text-gray-800">No subject assignments yet</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            You do not currently have any class subjects assigned. Please ask your school administrator to assign you to a class subject.
          </p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          <Filter size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="font-semibold text-gray-700">No matching subjects found</p>
          <p className="mt-1 text-gray-500">Try adjusting your search terms or filters.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={13} /> Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssignments.map((assignment) => {
            const cls = assignment.class || {};
            const classId = cls._id || cls.id;
            const studentCount = cls.students?.length || 0;
            const components = assignment.gradingSystem?.components || [];

            return (
              <div
                key={assignment._id}
                className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        Grade {cls.gradeLevel}
                      </span>
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
                        Section {cls.section}
                      </span>
                    </div>

                    <span className="text-[11px] font-medium text-gray-500">
                      {cls.schoolYear}
                    </span>
                  </div>

                  {/* Class Name */}
                  <h2
                    onClick={() => navigate(`/teacher/classes/${classId}`)}
                    className="mt-3 cursor-pointer text-lg font-bold text-gray-900 transition hover:text-blue-600"
                  >
                    {cls.name}
                  </h2>

                  {/* Subject Tag */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded-lg bg-blue-50 border border-blue-200/60 px-3 py-1 text-xs font-bold text-blue-800">
                      {assignment.subject}
                    </span>
                  </div>

                  {/* Enrolled Students & Components */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={14} className="text-blue-600" />
                        <strong className="text-gray-900">{studentCount}</strong>{" "}
                        {studentCount === 1 ? "student" : "students"}
                      </span>

                      <button
                        type="button"
                        onClick={() => setInviteModalClass(cls)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <UserPlus size={12} />
                        Invite Students
                      </button>
                    </div>

                    {/* Component breakdown */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {components.map((c) => (
                        <span
                          key={c.key}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
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
                </div>

                {/* Footer Buttons */}
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-100 pt-3.5">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/teacher/activities?assignmentId=${assignment._id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
                    >
                      <ClipboardList size={13} />
                      Activities
                    </Link>

                    <Link
                      to={`/teacher/scores?classId=${classId}&assignmentId=${assignment._id}&tab=scores`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
                    >
                      <BarChart3 size={13} />
                      Scores
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/teacher/classes/${classId}`)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                  >
                    Class Details
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================
          TEACHER INVITE STUDENTS MODAL
      ================================================== */}
      {inviteModalClass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInviteModalClass(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Invite Students</h2>
                <p className="text-xs text-gray-500">
                  {inviteModalClass.name} · Section {inviteModalClass.section} (Grade {inviteModalClass.gradeLevel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalClass(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <StudentInviteManager
                classData={inviteModalClass}
                isTeacher={true}
                teacherUserId={user?._id}
                onClose={() => setInviteModalClass(null)}
                onSuccess={async () => {
                  await loadAssignments();
                  setInviteModalClass(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
