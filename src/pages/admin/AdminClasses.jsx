import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Users,
  UserPlus,
  X,
  ChevronRight,
  Search,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { useSchoolData } from "../../context/SchoolDataContext";

import StudentInviteManager from "../../components/classes/StudentInviteManager";
import { getSectionsForGrade } from "../../constants/sections";
import { getSubjectAssignments } from "../../services/schoolDataService";

function AdminClasses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { classes, loading, createClass, reloadData } = useSchoolData();
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [schoolYearFilter, setSchoolYearFilter] = useState("all");

  useEffect(() => {
    getSubjectAssignments()
      .then((data) => setSubjectAssignments(data || []))
      .catch((error) => showToast(error.message || "Unable to load class subjects.", "error"));
  }, [showToast]);


  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Selected class
  const [selectedClassId, setSelectedClassId] = useState(null);

  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [isCustomSection, setIsCustomSection] = useState(false);
  const [customSection, setCustomSection] = useState("");

  // --------------------------------------------------
  // DEFAULT FORMS - Automatic grading is true by default
  // --------------------------------------------------

  const defaultClassForm = {
    name: "",
    section: "",
    gradeLevel: "",
    schoolYear: "2026-2027",
  };

  const [classForm, setClassForm] = useState(defaultClassForm);

  // Sections for the selected grade level
  const availableSections = useMemo(() => {
    return getSectionsForGrade(classForm.gradeLevel, classes);
  }, [classForm.gradeLevel, classes]);

  // --------------------------------------------------
  // CREATE CLASS MODAL
  // --------------------------------------------------

  const openCreateClassModal = () => {
    setIsCustomSection(false);
    setCustomSection("");
    setClassForm({
      ...defaultClassForm,
    });

    setShowClassModal(true);
  };

  const closeCreateClassModal = () => {
    if (isCreatingClass) return;

    setShowClassModal(false);
    setIsCustomSection(false);
    setCustomSection("");

    setClassForm({
      ...defaultClassForm,
    });
  };

  // --------------------------------------------------
  // INVITE STUDENT MODAL
  // --------------------------------------------------

  const openInviteModal = (classId) => {
    setSelectedClassId(classId);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setSelectedClassId(null);
  };

  const selectedClassForInvite = classes.find(
    (classItem) =>
      String(classItem._id || classItem.id) === String(selectedClassId)
  );

  const schoolYears = [...new Set(classes.map((item) => item.schoolYear).filter(Boolean))]
    .sort((a, b) => String(b).localeCompare(String(a)));
  const filteredClasses = classes.filter((classItem) => {
    const classId = String(classItem._id || classItem.id);
    const assignmentData = subjectAssignments.filter((item) => String(item.class?._id || item.class) === classId);
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [classItem.name, classItem.section, classItem.schoolYear, ...assignmentData.flatMap((item) => [item.subject, item.teacher?.name])]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesGrade = gradeFilter === "all" || String(classItem.gradeLevel) === gradeFilter;
    const matchesYear = schoolYearFilter === "all" || String(classItem.schoolYear) === schoolYearFilter;
    return matchesQuery && matchesGrade && matchesYear;
  });

  // --------------------------------------------------
  // FORM HANDLERS
  // --------------------------------------------------

  const handleClassChange = (e) => {
    const { name, value } = e.target;

    setClassForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGradeLevelChange = (e) => {
    const newGrade = e.target.value;
    setClassForm((prev) => ({
      ...prev,
      gradeLevel: newGrade,
      section: "", // reset section when grade level changes
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

  // --------------------------------------------------
  // CREATE CLASS
  // --------------------------------------------------

  const handleCreateClass = async (e) => {
    e.preventDefault();

    if (isCreatingClass) return;

    const resolvedSection = (
      isCustomSection ? customSection : classForm.section
    ).trim();

    if (
      !classForm.name.trim() ||
      !resolvedSection ||
      !classForm.gradeLevel ||
      !classForm.schoolYear
    ) {
      showToast(
        "Please complete all required class fields.",
        "warning"
      );

      return;
    }

    try {
      setIsCreatingClass(true);

      await createClass({
        name: classForm.name.trim(),
        section: resolvedSection,
        gradeLevel: Number(classForm.gradeLevel),
        schoolYear: classForm.schoolYear,
      });

      await reloadData();

      setShowClassModal(false);
      setIsCustomSection(false);
      setCustomSection("");

      setClassForm({
        ...defaultClassForm,
      });

      showToast(
        "Class created successfully.",
        "success"
      );
    } catch (error) {
      console.error("Failed to create class:", error);

      showToast(
        error.message || "Failed to create class.",
        "error"
      );
    } finally {
      setIsCreatingClass(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="space-y-6">

      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage classes, teachers, and students.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateClassModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Class
        </button>

      </div>

      {/* ==================================================
          CLASS CARDS
      ================================================== */}

      {classes.length > 0 && (
        <section className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_200px]">
          <label className="relative block text-sm font-medium text-gray-700">
            Search classes
            <Search size={17} className="pointer-events-none absolute left-3 top-[2.55rem] -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Class, section, subject, or teacher" className="mt-1 w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 font-normal outline-none focus:border-blue-500" />
          </label>
          <label className="text-sm font-medium text-gray-700">Grade level
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal">
              <option value="all">All grades</option>
              {[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={String(grade)}>Grade {grade}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">School year
            <select value={schoolYearFilter} onChange={(event) => setSchoolYearFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal">
              <option value="all">All school years</option>
              {schoolYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </section>
      )}

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
          Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center">

          <Users
            size={40}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 font-semibold text-gray-700">
            No classes available
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create a class to get started.
          </p>

          <button
            type="button"
            onClick={openCreateClassModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={17} />
            Create Class
          </button>

        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">No classes match these search and filter settings.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

          {filteredClasses.map((classItem) => {

            const classId =
              classItem._id || classItem.id;
            const assignments = subjectAssignments.filter((item) => String(item.class?._id || item.class) === String(classId));
            const teacherCount = new Set(assignments.map((item) => item.teacher?._id).filter(Boolean)).size;

            return (
              <div
                key={classId}
                className="group rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >

                {/* CLICKABLE CLASS CONTENT */}
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/admin/classes/${classId}`)
                  }
                  className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >

                  <div className="flex items-start justify-between">

                    <div className="min-w-0">

                      <h2 className="truncate font-semibold text-gray-800 group-hover:text-blue-600">
                        {classItem.name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Section {classItem.section}
                      </p>

                    </div>

                    <div className="ml-3 flex shrink-0 items-center gap-2">

                      <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                        <Users size={20} />
                      </div>

                      <ChevronRight
                        size={18}
                        className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500"
                      />

                    </div>

                  </div>

                  <div className="mt-5 border-t pt-4">
                    <p className="text-sm font-semibold text-gray-700">{teacherCount} assigned {teacherCount === 1 ? "teacher" : "teachers"} · {assignments.length} active {assignments.length === 1 ? "subject" : "subjects"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {assignments.length ? assignments.slice(0, 4).map((item) => <span key={item._id} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{item.subject}</span>) : <span className="text-xs text-gray-400">No subjects assigned</span>}
                      {assignments.length > 4 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">+{assignments.length - 4}</span>}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">

                    <Users size={16} />

                    <span>
                      {classItem.students?.length || 0}{" "}
                      {(classItem.students?.length || 0) === 1
                        ? "student"
                        : "students"}
                    </span>

                  </div>

                  <div className="mt-2 text-sm text-gray-500">
                    Grade {classItem.gradeLevel}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    School Year {classItem.schoolYear}
                  </div>

                </button>

                {/* INVITE BUTTON */}
                <button
                  type="button"
                  onClick={() =>
                    openInviteModal(classId)
                  }
                  className="ml-auto mt-4 flex w-fit items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-blue-700"
                >
                  <UserPlus size={17} />
                  Invite Students
                </button>

              </div>
            );
          })}

        </div>
      )}

      {/* ==================================================
          CREATE CLASS MODAL
      ================================================== */}

      {showClassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateClassModal();
            }
          }}
        >

          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b px-6 py-4">

              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Create Class
                </h2>

                <p className="text-sm text-gray-500">
                  Add a new class and configure its grading system.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateClassModal}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>

            </div>

            {/* FORM */}
            <form
              onSubmit={handleCreateClass}
              className="space-y-5 p-6"
            >

              {/* CLASS NAME */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Class Name
                </label>

                <input
                  name="name"
                  value={classForm.name}
                  onChange={handleClassChange}
                  placeholder="e.g. Grade 10 - ICT"
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* GRADE + SECTION */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Grade Level
                  </label>

                  <select
                    name="gradeLevel"
                    value={classForm.gradeLevel}
                    onChange={handleGradeLevelChange}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select grade
                    </option>

                    <option value="7">Grade 7</option>
                    <option value="8">Grade 8</option>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Section
                  </label>

                  <select
                    name="section"
                    value={isCustomSection ? "__custom__" : classForm.section}
                    onChange={handleSectionChange}
                    disabled={!classForm.gradeLevel}
                    required={!isCustomSection}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!classForm.gradeLevel
                        ? "Select grade level first"
                        : "Select section"}
                    </option>

                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}

                    {classForm.gradeLevel && (
                      <option value="__custom__">
                        + Add Custom Section...
                      </option>
                    )}
                  </select>

                  {isCustomSection && (
                    <input
                      type="text"
                      value={customSection}
                      onChange={(e) => {
                        setCustomSection(e.target.value);
                        setClassForm((prev) => ({
                          ...prev,
                          section: e.target.value,
                        }));
                      }}
                      placeholder="Enter section name"
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  )}
                </div>

              </div>

              {/* SCHOOL YEAR */}
              <div>

                <label className="block text-sm font-medium text-gray-700">
                  School Year
                </label>

                <select
                  name="schoolYear"
                  value={classForm.schoolYear}
                  onChange={handleClassChange}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                >
                  <option value="2026-2027">
                    2026-2027
                  </option>

                  <option value="2027-2028">
                    2027-2028
                  </option>
                </select>

              </div>

              {/* ACTIONS */}
              <div className="flex justify-end gap-3 border-t pt-5">

                <button
                  type="button"
                  onClick={closeCreateClassModal}
                  disabled={isCreatingClass}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreatingClass}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingClass
                    ? "Creating..."
                    : "Create Class"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ==================================================
          INVITE STUDENTS MODAL (Searchbar + Grade-level + Multi)
      ================================================== */}

      {showInviteModal && selectedClassForInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeInviteModal();
            }
          }}
        >

          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b px-6 py-4">

              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Invite Students
                </h2>

                <p className="text-sm text-gray-500">
                  {selectedClassForInvite.name} · Section {selectedClassForInvite.section}
                </p>
              </div>

              <button
                type="button"
                onClick={closeInviteModal}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
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

export default AdminClasses;
