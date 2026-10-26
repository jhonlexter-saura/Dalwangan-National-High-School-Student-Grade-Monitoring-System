import { useEffect, useState, useMemo } from "react";
import { Plus, Users, GraduationCap, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

import {
  getClassesByTeacher,
  createClassForTeacher,
} from "../../services/schoolDataService";
import StudentInviteManager from "../../components/classes/StudentInviteManager";
import { getSectionsForGrade } from "../../constants/sections";

function TeacherClasses() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Selected class for invitation
  const [selectedClassId, setSelectedClassId] = useState(null);

  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [isCustomSection, setIsCustomSection] = useState(false);
  const [customSection, setCustomSection] = useState("");

  // Create class form - Automatic grading is true by default
  const defaultClassForm = {
    name: "",
    section: "",
    gradeLevel: "",
    schoolYear: "2026-2027",

    gradingSystemEnabled: true,
    writtenWorkPercentage: "30",
    performanceTaskPercentage: "50",
    assessmentPercentage: "20",
  };

  const [formData, setFormData] = useState(defaultClassForm);

  // Sections for the selected grade level
  const availableSections = useMemo(() => {
    return getSectionsForGrade(formData.gradeLevel, classes);
  }, [formData.gradeLevel, classes]);

  // --------------------------------------------------
  // LOAD CLASSES
  // --------------------------------------------------

  const loadClasses = async () => {
    if (!user?._id) return;

    try {
      setLoading(true);

      const data = await getClassesByTeacher(user._id);

      setClasses(data);
    } catch (err) {
      console.error("Failed to load teacher classes:", err);

      showToast(
        err.message || "Failed to load classes.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [user?._id]);

  // --------------------------------------------------
  // CREATE CLASS MODAL
  // --------------------------------------------------

  const openCreateClassModal = () => {
    setIsCustomSection(false);
    setCustomSection("");
    setFormData({
      ...defaultClassForm,
    });

    setShowClassModal(true);
  };

  const closeCreateClassModal = () => {
    if (isCreatingClass) return;

    setShowClassModal(false);
    setIsCustomSection(false);
    setCustomSection("");
    setFormData({
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
    (item) => String(item._id || item.id) === String(selectedClassId)
  );

  // --------------------------------------------------
  // FORM HANDLERS
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGradeLevelChange = (e) => {
    const newGrade = e.target.value;
    setFormData((prev) => ({
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
      setFormData((prev) => ({ ...prev, section: "" }));
    } else {
      setIsCustomSection(false);
      setFormData((prev) => ({ ...prev, section: val }));
    }
  };

  // --------------------------------------------------
  // CREATE CLASS
  // --------------------------------------------------

  const handleCreateClass = async (e) => {
    e.preventDefault();

    if (isCreatingClass) return;

    const resolvedSection = (
      isCustomSection ? customSection : formData.section
    ).trim();

    if (
      !formData.name.trim() ||
      !resolvedSection ||
      !formData.gradeLevel ||
      !formData.schoolYear
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
        Number(formData.writtenWorkPercentage),
        Number(formData.performanceTaskPercentage),
        Number(formData.assessmentPercentage),
      ];

      // Validate grading percentages
      if (
        formData.gradingSystemEnabled &&
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
        formData.gradingSystemEnabled &&
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
        enabled: formData.gradingSystemEnabled,

        components: formData.gradingSystemEnabled
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

      const createdClass = await createClassForTeacher(
        user._id,
        {
          name: formData.name.trim(),
          section: resolvedSection,
          gradeLevel: Number(formData.gradeLevel),
          schoolYear: formData.schoolYear,
          gradingSystem,
        }
      );

      setClasses((prev) => [
        createdClass,
        ...prev,
      ]);

      setShowClassModal(false);
      setIsCustomSection(false);
      setCustomSection("");

      setFormData({
        ...defaultClassForm,
      });

      showToast(
        "Class created successfully.",
        "success"
      );
    } catch (err) {
      console.error("Failed to create class:", err);

      showToast(
        err.message || "Failed to create class.",
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

      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage the classes assigned to you.
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

      {/* CLASS CARDS */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">

          <GraduationCap
            size={40}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 font-semibold text-gray-900">
            No classes yet
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create your first class to get started.
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

          {classes.map((item) => {
            const classId = item._id || item.id;

            return (
              <div
                key={classId}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >

                {/* CLICKABLE CLASS CONTENT */}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/teacher/classes/${classId}`
                    )
                  }
                  className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex items-start justify-between">

                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-gray-900">
                        {item.name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Section {item.section}
                      </p>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                      <GraduationCap size={20} />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2 text-sm text-gray-500">
                    <Users size={17} />

                    <span>
                      {item.students?.length || 0}{" "}
                      {(item.students?.length || 0) === 1
                        ? "student"
                        : "students"}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-gray-500">
                    Grade {item.gradeLevel}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    School Year {item.schoolYear}
                  </div>

                  {item.gradingSystem?.enabled && (
                    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">
                        Automatic Grading
                      </span>

                      <div className="mt-1">
                        {item.gradingSystem.components?.map(
                          (component) => (
                            <span
                              key={component.key}
                              className="mr-3"
                            >
                              {component.name}:{" "}
                              {component.percentage}%
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </button>

                {/* INVITE STUDENTS BUTTON */}
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

                {/* STUDENTS PREVIEW */}
                {item.students?.length > 0 && (
                  <div className="mt-5 border-t pt-4">

                    <p className="mb-3 text-sm font-semibold text-gray-700">
                      Students
                    </p>

                    <div className="space-y-3">
                      {item.students.map((student) => (
                        <div
                          key={student._id || student.id}
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
                      ))}
                    </div>

                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

      {/* ================================================== */}
      {/* CREATE CLASS MODAL */}
      {/* ================================================== */}

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

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b px-6 py-4">

              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Create Class
                </h2>

                <p className="text-sm text-gray-500">
                  Add a new class and configure its grading system.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateClassModal}
                className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100"
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
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Grade 10 - Mathematics"
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
                    value={formData.gradeLevel}
                    onChange={handleGradeLevelChange}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select grade level
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
                    value={isCustomSection ? "__custom__" : formData.section}
                    onChange={handleSectionChange}
                    disabled={!formData.gradeLevel}
                    required={!isCustomSection}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!formData.gradeLevel
                        ? "Select grade level first"
                        : "Select section"}
                    </option>

                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}

                    {formData.gradeLevel && (
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
                        setFormData((prev) => ({
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
                  value={formData.schoolYear}
                  onChange={handleChange}
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
                      checked={formData.gradingSystemEnabled}
                      onChange={(e) =>
                        setFormData((prev) => ({
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

                {formData.gradingSystemEnabled && (
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
                              value={formData[name]}
                              onChange={handleChange}
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
                        Number(formData.writtenWorkPercentage) +
                          Number(formData.performanceTaskPercentage) +
                          Number(formData.assessmentPercentage) ===
                        100
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Total:{" "}
                      {Number(
                        formData.writtenWorkPercentage || 0
                      ) +
                        Number(
                          formData.performanceTaskPercentage || 0
                        ) +
                        Number(
                          formData.assessmentPercentage || 0
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

      {/* ================================================== */}
      {/* INVITE STUDENTS MODAL (Searchbar + Grade-level + Multi) */}
      {/* ================================================== */}

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
                <h2 className="text-lg font-semibold text-gray-900">
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
                isTeacher={true}
                teacherUserId={user?._id}
                onClose={closeInviteModal}
                onSuccess={async () => {
                  await loadClasses();
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

export default TeacherClasses;
