import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSchoolData } from "../../context/SchoolDataContext";

import {
  Plus,
  Users,
  X,
  ChevronRight,
} from "lucide-react";

function TeacherClasses() {
  const navigate = useNavigate();

  const {
    classes,
    createClass,
    loading,
  } = useSchoolData();

  const [showClassModal, setShowClassModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [classForm, setClassForm] = useState({
    name: "",
    section: "",
    gradeLevel: "",
    adviser: "",
    schoolYear: "2026-2027",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setClassForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setClassForm({
      name: "",
      section: "",
      gradeLevel: "",
      adviser: "",
      schoolYear: "2026-2027",
    });

    setShowClassModal(true);
  };

  const closeCreateModal = () => {
    if (isCreating) return;

    setShowClassModal(false);
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();

    const name = classForm.name.trim();
    const section = classForm.section.trim();
    const adviser = classForm.adviser.trim();

    if (
      !name ||
      !section ||
      !classForm.gradeLevel ||
      !adviser ||
      !classForm.schoolYear
    ) {
      alert("Please complete all fields.");
      return;
    }

    if (isCreating) return;

    try {
      setIsCreating(true);

      await createClass({
        name,
        section,
        gradeLevel: Number(classForm.gradeLevel),
        adviser,
        schoolYear: classForm.schoolYear,
      });

      setShowClassModal(false);

      setClassForm({
        name: "",
        section: "",
        gradeLevel: "",
        adviser: "",
        schoolYear: "2026-2027",
      });
    } catch (error) {
      console.error("Failed to create class:", error);
      alert(error.message || "Failed to create class.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            My Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create and manage your classes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Class
        </button>
      </div>

      {/* CLASS LIST */}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full rounded-lg border bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loading classes...
            </p>
          </div>
        ) : classes.length > 0 ? (
          classes.map((classItem) => (
            <div
              key={classItem.id}
              className="group rounded-lg border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              {/* CLICKABLE CLASS AREA */}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/teacher/activities?classId=${classItem.id}`
                  )
                }
                className="block w-full cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-gray-800 group-hover:text-blue-600">
                      {classItem.name}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Grade {classItem.gradeLevel} ·{" "}
                      {classItem.section}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {classItem.schoolYear}
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
                    Adviser
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {classItem.adviser}
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
              </button>

              {/* FUTURE T-007 AREA */}
              <div className="mt-5 border-t pt-4">
                <p className="text-xs text-gray-400">
                  Click the class to manage activities and
                  students.
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-lg border bg-white p-10 text-center shadow-sm">
            <Users
              size={40}
              className="mx-auto text-gray-400"
            />

            <h2 className="mt-4 font-semibold text-gray-700">
              No classes yet
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create your first class to get started.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={17} />
              Create Class
            </button>
          </div>
        )}
      </div>

      {/* CREATE CLASS MODAL */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Create Class
                </h2>

                <p className="text-sm text-gray-500">
                  Add a new class to your classes.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isCreating}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleCreateClass}
              className="space-y-4 p-6"
            >
              {/* CLASS NAME */}
              <div>
                <label
                  htmlFor="teacher-class-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Class Name
                </label>

                <input
                  id="teacher-class-name"
                  name="name"
                  type="text"
                  value={classForm.name}
                  onChange={handleChange}
                  placeholder="e.g. Grade 10 - ICT A"
                  disabled={isCreating}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* GRADE + SECTION */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="teacher-grade-level"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Grade Level
                  </label>

                  <select
                    id="teacher-grade-level"
                    name="gradeLevel"
                    value={classForm.gradeLevel}
                    onChange={handleChange}
                    disabled={isCreating}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">
                      Select
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
                  <label
                    htmlFor="teacher-section"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Section
                  </label>

                  <input
                    id="teacher-section"
                    name="section"
                    type="text"
                    value={classForm.section}
                    onChange={handleChange}
                    placeholder="ICT A"
                    disabled={isCreating}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* ADVISER */}
              <div>
                <label
                  htmlFor="teacher-adviser"
                  className="block text-sm font-medium text-gray-700"
                >
                  Adviser
                </label>

                <input
                  id="teacher-adviser"
                  name="adviser"
                  type="text"
                  value={classForm.adviser}
                  onChange={handleChange}
                  placeholder="Teacher name"
                  disabled={isCreating}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* SCHOOL YEAR */}
              <div>
                <label
                  htmlFor="teacher-school-year"
                  className="block text-sm font-medium text-gray-700"
                >
                  School Year
                </label>

                <select
                  id="teacher-school-year"
                  name="schoolYear"
                  value={classForm.schoolYear}
                  onChange={handleChange}
                  disabled={isCreating}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="2026-2027">
                    2026-2027
                  </option>

                  <option value="2025-2026">
                    2025-2026
                  </option>
                </select>
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isCreating}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating
                    ? "Creating..."
                    : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherClasses;