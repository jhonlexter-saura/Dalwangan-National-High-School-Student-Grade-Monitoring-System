import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Users,
  UserPlus,
  X,
  ChevronRight,
  Search,
  BookOpen,
  GraduationCap,
  Edit2,
  Trash2,
  MoreVertical,
  Filter,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { useSchoolData } from "../../context/SchoolDataContext";

import StudentInviteManager from "../../components/classes/StudentInviteManager";
import { getSectionsForGrade } from "../../constants/sections";
import { getSubjectAssignments } from "../../services/schoolDataService";

export default function AdminClasses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { classes, loading, createClass, updateClass, deleteClass, reloadData } = useSchoolData();

  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [schoolYearFilter, setSchoolYearFilter] = useState("all");

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null); // null for create, object for edit
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeMenuClassId, setActiveMenuClassId] = useState(null);

  // Selected class for invite
  const [selectedClassId, setSelectedClassId] = useState(null);

  const [isSavingClass, setIsSavingClass] = useState(false);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [isCustomSection, setIsCustomSection] = useState(false);
  const [customSection, setCustomSection] = useState("");

  const defaultClassForm = {
    name: "",
    section: "",
    gradeLevel: "",
    schoolYear: "2026-2027",
  };

  const [classForm, setClassForm] = useState(defaultClassForm);

  useEffect(() => {
    setLoadingAssignments(true);
    getSubjectAssignments()
      .then((data) => setSubjectAssignments(data || []))
      .catch((error) => showToast(error.message || "Unable to load class subjects.", "error"))
      .finally(() => setLoadingAssignments(false));
  }, [showToast]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuClassId(null);
    }
    if (activeMenuClassId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [activeMenuClassId]);

  // Sections for the selected grade level
  const availableSections = useMemo(() => {
    return getSectionsForGrade(classForm.gradeLevel, classes);
  }, [classForm.gradeLevel, classes]);

  // Distinct school years
  const schoolYears = useMemo(() => {
    return [...new Set(classes.map((item) => item.schoolYear).filter(Boolean))]
      .sort((a, b) => String(b).localeCompare(String(a)));
  }, [classes]);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      const classId = String(classItem._id || classItem.id);
      const assignmentData = subjectAssignments.filter(
        (item) => String(item.class?._id || item.class) === classId
      );
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [
          classItem.name,
          classItem.section,
          classItem.schoolYear,
          ...assignmentData.flatMap((item) => [item.subject, item.teacher?.name]),
        ].some((value) => String(value || "").toLowerCase().includes(query));

      const matchesGrade =
        gradeFilter === "all" || String(classItem.gradeLevel) === gradeFilter;
      const matchesYear =
        schoolYearFilter === "all" || String(classItem.schoolYear) === schoolYearFilter;

      return matchesQuery && matchesGrade && matchesYear;
    });
  }, [classes, subjectAssignments, search, gradeFilter, schoolYearFilter]);

  const totalStudentsCount = useMemo(() => {
    return classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);
  }, [classes]);

  const hasActiveFilters = search.trim() !== "" || gradeFilter !== "all" || schoolYearFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setGradeFilter("all");
    setSchoolYearFilter("all");
  };

  // --------------------------------------------------
  // MODAL HANDLERS
  // --------------------------------------------------

  const openCreateClassModal = () => {
    setEditingClass(null);
    setIsCustomSection(false);
    setCustomSection("");
    setClassForm({ ...defaultClassForm });
    setShowClassModal(true);
  };

  const openEditClassModal = (cls) => {
    setEditingClass(cls);
    const sectionsForGrade = getSectionsForGrade(cls.gradeLevel, classes);
    const isCustom = cls.section && !sectionsForGrade.includes(cls.section);
    setIsCustomSection(isCustom);
    setCustomSection(isCustom ? cls.section : "");
    setClassForm({
      name: cls.name || "",
      section: cls.section || "",
      gradeLevel: String(cls.gradeLevel || ""),
      schoolYear: cls.schoolYear || "2026-2027",
    });
    setShowClassModal(true);
  };

  const closeClassModal = () => {
    if (isSavingClass) return;
    setShowClassModal(false);
    setEditingClass(null);
    setIsCustomSection(false);
    setCustomSection("");
    setClassForm({ ...defaultClassForm });
  };

  const openInviteModal = (classId) => {
    setSelectedClassId(classId);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setSelectedClassId(null);
  };

  const selectedClassForInvite = classes.find(
    (classItem) => String(classItem._id || classItem.id) === String(selectedClassId)
  );

  // --------------------------------------------------
  // FORM HANDLERS
  // --------------------------------------------------

  const handleClassChange = (e) => {
    const { name, value } = e.target;
    setClassForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGradeLevelChange = (e) => {
    const newGrade = e.target.value;
    setClassForm((prev) => ({
      ...prev,
      gradeLevel: newGrade,
      section: "",
    }));
    setIsCustomSection(false);
    setCustomSection("");
  };

  const handleSectionChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setIsCustomSection(true);
      setClassForm((prev) => ({ ...prev, section: "" }));
    } else {
      setIsCustomSection(false);
      setClassForm((prev) => ({ ...prev, section: val }));
    }
  };

  const handleSaveClass = async (e) => {
    e.preventDefault();
    if (isSavingClass) return;

    const resolvedSection = (isCustomSection ? customSection : classForm.section).trim();

    if (!classForm.name.trim() || !resolvedSection || !classForm.gradeLevel || !classForm.schoolYear) {
      showToast("Please complete all required class fields.", "warning");
      return;
    }

    try {
      setIsSavingClass(true);

      const payload = {
        name: classForm.name.trim(),
        section: resolvedSection,
        gradeLevel: Number(classForm.gradeLevel),
        schoolYear: classForm.schoolYear,
      };

      if (editingClass) {
        const classId = editingClass._id || editingClass.id;
        if (updateClass) {
          await updateClass(classId, payload);
        }
        await reloadData();
        showToast("Class updated successfully.", "success");
      } else {
        await createClass(payload);
        await reloadData();
        showToast("Class created successfully.", "success");
      }

      closeClassModal();
    } catch (error) {
      console.error("Failed to save class:", error);
      showToast(error.message || "Failed to save class.", "error");
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleDeleteClass = async (cls) => {
    const classId = cls._id || cls.id;
    const studentCount = cls.students?.length || 0;
    const msg = studentCount > 0
      ? `This class currently has ${studentCount} enrolled student(s). Are you sure you want to permanently delete "${cls.name}"?`
      : `Are you sure you want to delete "${cls.name}"?`;

    if (!window.confirm(msg)) return;

    try {
      setIsDeletingClass(true);
      if (deleteClass) {
        await deleteClass(classId);
      }
      await reloadData();
      showToast("Class deleted successfully.", "success");
    } catch (err) {
      showToast(err.message || "Failed to delete class.", "error");
    } finally {
      setIsDeletingClass(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================
          PAGE HEADER & SUMMARY
      ================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Class Management
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {classes.length} {classes.length === 1 ? "Class" : "Classes"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Configure classes, sections, subject assignments, and student rosters.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateClassModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus size={18} />
          Create New Class
        </button>
      </div>

      {/* ==================================================
          OVERVIEW KPI STATS
      ================================================== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-blue-600">
            <GraduationCap size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Classes
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{classes.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-green-600">
            <Users size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Students
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totalStudentsCount}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-purple-600">
            <BookOpen size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Subject Offerings
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{subjectAssignments.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-amber-600">
            <Sparkles size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              School Year
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-gray-900 truncate">
            {schoolYears[0] || "2026-2027"}
          </p>
        </div>
      </div>

      {/* ==================================================
          SEARCH & FILTER TOOLBAR
      ================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class name, section, subject, or teacher..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-9 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Grade filter */}
          <div className="w-full sm:w-44">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Grades</option>
              {[7, 8, 9, 10, 11, 12].map((grade) => (
                <option key={grade} value={String(grade)}>
                  Grade {grade}
                </option>
              ))}
            </select>
          </div>

          {/* School Year filter */}
          <div className="w-full sm:w-48">
            <select
              value={schoolYearFilter}
              onChange={(e) => setSchoolYearFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All School Years</option>
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
        </div>

        {/* Filter summary status */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>
            Showing <strong className="font-semibold text-gray-800">{filteredClasses.length}</strong> of{" "}
            <strong className="font-semibold text-gray-800">{classes.length}</strong> classes
            {hasActiveFilters && " (filtered)"}
          </span>
          {hasActiveFilters && (
            <span className="text-blue-600 font-medium">Filters active</span>
          )}
        </div>
      </div>

      {/* ==================================================
          CLASS CARDS GRID
      ================================================== */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          Loading class records...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
          <GraduationCap size={44} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-lg font-semibold text-gray-800">No classes created yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create your first class to begin assigning teachers, subjects, and enrolling students.
          </p>
          <button
            type="button"
            onClick={openCreateClassModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus size={17} />
            Create First Class
          </button>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
          <Filter size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="font-semibold text-gray-700 text-base">No classes found</p>
          <p className="mt-1 text-gray-500">No classes match your current search or filter criteria.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={13} />
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((classItem) => {
            const classId = classItem._id || classItem.id;
            const assignments = subjectAssignments.filter(
              (item) => String(item.class?._id || item.class) === String(classId)
            );
            const teacherCount = new Set(
              assignments.map((item) => item.teacher?._id || item.teacher?.user).filter(Boolean)
            ).size;
            const studentCount = classItem.students?.length || 0;
            const isMenuOpen = activeMenuClassId === classId;

            return (
              <div
                key={classId}
                className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: Grade Badge, Section Badge, and Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        Grade {classItem.gradeLevel}
                      </span>
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
                        Section {classItem.section}
                      </span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {classItem.schoolYear}
                      </span>
                    </div>

                    {/* Context menu for Edit/Delete */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuClassId(isMenuOpen ? null : classId);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Class actions"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuClassId(null);
                              openEditClassModal(classItem);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 size={14} className="text-gray-500" />
                            Edit Class Info
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuClassId(null);
                              openInviteModal(classId);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <UserPlus size={14} className="text-blue-600" />
                            Invite Students
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuClassId(null);
                              handleDeleteClass(classItem);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} className="text-red-500" />
                            Delete Class
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Class Name */}
                  <h2
                    onClick={() => navigate(`/admin/classes/${classId}`)}
                    className="mt-3 cursor-pointer text-lg font-bold text-gray-900 transition hover:text-blue-600"
                  >
                    {classItem.name}
                  </h2>

                  {/* Student & Teacher summary stats */}
                  <div className="mt-3 flex items-center gap-4 text-xs font-medium text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={15} className="text-blue-600" />
                      <strong className="text-gray-900">{studentCount}</strong>{" "}
                      {studentCount === 1 ? "student" : "students"}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen size={15} className="text-purple-600" />
                      <strong className="text-gray-900">{assignments.length}</strong>{" "}
                      {assignments.length === 1 ? "subject" : "subjects"}
                    </span>
                  </div>

                  {/* Subject Badges */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Assigned Subjects
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {assignments.length > 0 ? (
                        <>
                          {assignments.slice(0, 3).map((item) => (
                            <span
                              key={item._id}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {item.subject}
                            </span>
                          ))}
                          {assignments.length > 3 && (
                            <span className="rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
                              +{assignments.length - 3} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs italic text-gray-400">
                          No subjects assigned yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-100 pt-3.5">
                  <button
                    type="button"
                    onClick={() => openInviteModal(classId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700"
                  >
                    <UserPlus size={14} />
                    Invite Students
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/admin/classes/${classId}`)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                  >
                    Overview
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================
          CREATE / EDIT CLASS MODAL
      ================================================== */}
      {showClassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeClassModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingClass ? "Edit Class Details" : "Create New Class"}
                </h2>
                <p className="text-xs text-gray-500">
                  {editingClass
                    ? "Update class cohort information and section."
                    : "Add a class section for students and teacher subjects."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeClassModal}
                disabled={isSavingClass}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSaveClass} className="space-y-4 p-6">
              {/* CLASS NAME */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Class Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={classForm.name}
                  onChange={handleClassChange}
                  placeholder="e.g. Grade 10 - ICT or Grade 7 - Aguinaldo"
                  required
                  className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* GRADE & SECTION */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Grade Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gradeLevel"
                    value={classForm.gradeLevel}
                    onChange={handleGradeLevelChange}
                    required
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select Grade Level</option>
                    <option value="7">Grade 7</option>
                    <option value="8">Grade 8</option>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="section"
                    value={isCustomSection ? "__custom__" : classForm.section}
                    onChange={handleSectionChange}
                    disabled={!classForm.gradeLevel}
                    required={!isCustomSection}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!classForm.gradeLevel ? "Select grade first" : "Choose Section"}
                    </option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                    {classForm.gradeLevel && (
                      <option value="__custom__">+ Enter Custom Section...</option>
                    )}
                  </select>

                  {isCustomSection && (
                    <input
                      type="text"
                      value={customSection}
                      onChange={(e) => {
                        setCustomSection(e.target.value);
                        setClassForm((prev) => ({ ...prev, section: e.target.value }));
                      }}
                      placeholder="Type custom section name"
                      required
                      className="mt-2 w-full rounded-lg border border-blue-400 bg-blue-50/20 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                </div>
              </div>

              {/* SCHOOL YEAR */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  School Year <span className="text-red-500">*</span>
                </label>
                <select
                  name="schoolYear"
                  value={classForm.schoolYear}
                  onChange={handleClassChange}
                  required
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="2026-2027">2026-2027</option>
                  <option value="2027-2028">2027-2028</option>
                  <option value="2025-2026">2025-2026</option>
                </select>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={closeClassModal}
                  disabled={isSavingClass}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingClass}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingClass ? "Saving..." : editingClass ? "Save Changes" : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================
          INVITE STUDENTS MODAL
      ================================================== */}
      {showInviteModal && selectedClassForInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeInviteModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Invite Students to Class
                </h2>
                <p className="text-xs text-gray-500">
                  {selectedClassForInvite.name} · Section {selectedClassForInvite.section} (Grade {selectedClassForInvite.gradeLevel})
                </p>
              </div>

              <button
                type="button"
                onClick={closeInviteModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* MANAGER */}
            <div className="p-6">
              <StudentInviteManager
                classData={selectedClassForInvite}
                isTeacher={false}
                onClose={closeInviteModal}
                onSuccess={async () => {
                  await reloadData();
                  closeInviteModal();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
