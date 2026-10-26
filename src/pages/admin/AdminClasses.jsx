import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Users,
  UserPlus,
  X,
  ChevronRight,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { useSchoolData } from "../../context/SchoolDataContext";

import {
  getTeachers,
} from "../../services/schoolDataService";
import StudentInviteManager from "../../components/classes/StudentInviteManager";

function AdminClasses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { classes, loading, createClass, reloadData } = useSchoolData();

  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Selected class
  const [selectedClassId, setSelectedClassId] = useState(null);

  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // --------------------------------------------------
  // DEFAULT FORMS - Automatic grading is true by default
  // --------------------------------------------------

  const defaultClassForm = {
    name: "",
    section: "",
    gradeLevel: "",
    teacher: "",
    schoolYear: "2026-2027",

    gradingSystemEnabled: true,
    writtenWorkPercentage: "30",
    performanceTaskPercentage: "50",
    assessmentPercentage: "20",
  };

  const [classForm, setClassForm] = useState(defaultClassForm);

  // --------------------------------------------------
  // LOAD TEACHERS
  // --------------------------------------------------

  const loadTeachers = async () => {
    try {
      setLoadingTeachers(true);

      const data = await getTeachers();

      setTeachers(data);
    } catch (error) {
      console.error("Failed to load teachers:", error);

      showToast(
        error.message || "Failed to load teachers.",
        "error"
      );
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  // --------------------------------------------------
  // CREATE CLASS MODAL
  // --------------------------------------------------

  const openCreateClassModal = () => {
    setClassForm({
      ...defaultClassForm,
    });

    setShowClassModal(true);
  };

  const closeCreateClassModal = () => {
    if (isCreatingClass) return;

    setShowClassModal(false);

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

  // --------------------------------------------------
  // CREATE CLASS
  // --------------------------------------------------

  const handleCreateClass = async (e) => {
    e.preventDefault();

    if (isCreatingClass) return;

    if (
      !classForm.name.trim() ||
      !classForm.section.trim() ||
      !classForm.gradeLevel ||
      !classForm.teacher ||
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

      const percentages = [
        Number(classForm.writtenWorkPercentage),
        Number(classForm.performanceTaskPercentage),
        Number(classForm.assessmentPercentage),
      ];

      // Validate percentages
      if (
        classForm.gradingSystemEnabled &&
        percentages.some(
          (value) =>
            Number.isNaN(value) ||
            value < 0 ||
            value > 100
        )
      ) {
        showToast(
          "Each grading percentage must be between 0 and 100.",
          "warning"
        );

        return;
      }

      // Validate total
      if (
        classForm.gradingSystemEnabled &&
        percentages.reduce(
          (sum, value) => sum + value,
          0
        ) !== 100
      ) {
        showToast(
          "Grading percentages must total 100%.",
          "warning"
        );

        return;
      }

      const gradingSystem = {
        enabled: classForm.gradingSystemEnabled,

        components: classForm.gradingSystemEnabled
          ? [
              {
                key: "written_work",
                name: "Written Work",
                percentage: percentages[0],
              },
              {
                key: "performance_task",
                name: "Performance Tasks",
                percentage: percentages[1],
              },
              {
                key: "assessment",
                name: "Assessment",
                percentage: percentages[2],
              },
            ]
          : [],
      };

      await createClass({
        name: classForm.name.trim(),
        section: classForm.section.trim(),
        gradeLevel: Number(classForm.gradeLevel),
        teacher: classForm.teacher,
        schoolYear: classForm.schoolYear,
        gradingSystem,
      });

      await reloadData();

      setShowClassModal(false);

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
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

          {classes.map((classItem) => {

            const classId =
              classItem._id || classItem.id;

            const teacherName =
              classItem.teacher?.name ||
              classItem.adviser ||
              "No teacher assigned";

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

                    <p className="text-sm text-gray-500">
                      Teacher
                    </p>

                    <p className="mt-1 text-sm font-medium text-gray-800">
                      {teacherName}
                    </p>

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

                  {classItem.gradingSystem?.enabled && (
                    <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">

                      <p className="text-xs font-semibold text-gray-700">
                        Automatic Grading
                      </p>

                      <div className="mt-1 space-y-0.5 text-xs text-gray-500">

                        {classItem.gradingSystem.components?.map(
                          (component) => (
                            <div key={component.key}>
                              {component.name}:{" "}
                              {component.percentage}%
                            </div>
                          )
                        )}

                      </div>

                    </div>
                  )}

                </button>

                {/* INVITE BUTTON */}
                <button
                  type="button"
                  onClick={() =>
                    openInviteModal(classId)
                  }
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                >
                  <UserPlus size={17} />
                  Invite Students
                </button>

                {/* STUDENTS */}
                {classItem.students?.length > 0 && (
                  <div className="mt-5 border-t pt-4">

                    <p className="mb-3 text-sm font-semibold text-gray-700">
                      Students
                    </p>

                    <div className="space-y-3">

                      {classItem.students.map(
                        (student) => (
                          <div
                            key={
                              student._id ||
                              student.id
                            }
                            className="flex items-center gap-3"
                          >

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                              {student.name
                                ?.charAt(0)
                                .toUpperCase() || "S"}
                            </div>

                            <div className="min-w-0">

                              <p className="truncate text-sm font-medium text-gray-800">
                                {student.name}
                              </p>

                              <p className="truncate text-xs text-gray-500">
                                {student.email || student.studentId}
                              </p>

                            </div>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

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
                    onChange={handleClassChange}
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

                  <input
                    name="section"
                    value={classForm.section}
                    onChange={handleClassChange}
                    placeholder="e.g. Rizal"
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500"
                  />
                </div>

              </div>

              {/* TEACHER */}
              <div>

                <label className="block text-sm font-medium text-gray-700">
                  Teacher / Adviser
                </label>

                <select
                  name="teacher"
                  value={classForm.teacher}
                  onChange={handleClassChange}
                  required
                  disabled={loadingTeachers}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 disabled:bg-gray-100"
                >

                  <option value="">
                    {loadingTeachers
                      ? "Loading teachers..."
                      : "Select teacher"}
                  </option>

                  {teachers.map((teacher) => (
                    <option
                      key={teacher._id || teacher.id}
                      value={teacher._id || teacher.id}
                    >
                      {teacher.name}
                    </option>
                  ))}

                </select>

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

              {/* GRADING SYSTEM */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Grading System
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Automatically compute grades from activity scores.
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">

                    <input
                      type="checkbox"
                      name="gradingSystemEnabled"
                      checked={
                        classForm.gradingSystemEnabled
                      }
                      onChange={(e) =>
                        setClassForm((prev) => ({
                          ...prev,
                          gradingSystemEnabled:
                            e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    Automatic

                  </label>

                </div>

                {classForm.gradingSystemEnabled && (
                  <>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">

                      {[
                        [
                          "writtenWorkPercentage",
                          "Written Work",
                        ],
                        [
                          "performanceTaskPercentage",
                          "Performance Tasks",
                        ],
                        [
                          "assessmentPercentage",
                          "Assessment",
                        ],
                      ].map(([name, label]) => (
                        <div key={name}>

                          <label className="block text-sm font-medium text-gray-700">
                            {label}
                          </label>

                          <div className="relative mt-1">

                            <input
                              name={name}
                              type="number"
                              min="0"
                              max="100"
                              value={classForm[name]}
                              onChange={handleClassChange}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-9 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                              %
                            </span>

                          </div>

                        </div>
                      ))}

                    </div>

                    <p
                      className={`mt-3 text-sm ${
                        Number(
                          classForm.writtenWorkPercentage
                        ) +
                          Number(
                            classForm.performanceTaskPercentage
                          ) +
                          Number(
                            classForm.assessmentPercentage
                          ) ===
                        100
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Total:{" "}
                      {Number(
                        classForm.writtenWorkPercentage || 0
                      ) +
                        Number(
                          classForm.performanceTaskPercentage ||
                            0
                        ) +
                        Number(
                          classForm.assessmentPercentage || 0
                        )}
                      %
                    </p>

                  </>
                )}

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
