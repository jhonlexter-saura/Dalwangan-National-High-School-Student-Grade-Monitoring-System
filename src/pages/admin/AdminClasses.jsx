import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSchoolData } from "../../context/SchoolDataContext";

import {
  Plus,
  Users,
  UserPlus,
  X,
  ChevronRight,
} from "lucide-react";

function AdminClasses() {
  const navigate = useNavigate();

  const {
    classes,
    createClass,
    inviteStudent,
  } = useSchoolData();

  const [showClassModal, setShowClassModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState(null);

  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [isInvitingStudent, setIsInvitingStudent] = useState(false);

  const [classForm, setClassForm] = useState({
    name: "",
    section: "",
    gradeLevel: "",
    adviser: "",
    schoolYear: "2026-2027",
  });

  const [studentForm, setStudentForm] = useState({
    studentId: "",
    name: "",
    email: "",
  });

  const openCreateClassModal = () => {
    setClassForm({
      name: "",
      section: "",
      gradeLevel: "",
      adviser: "",
      schoolYear: "2026-2027",
    });

    setShowClassModal(true);
  };

  const openInviteModal = (classId) => {
    setSelectedClassId(classId);

    setStudentForm({
      studentId: "",
      name: "",
      email: "",
    });

    setShowInviteModal(true);
  };

  const handleClassChange = (e) => {
    const { name, value } = e.target;

    setClassForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStudentChange = (e) => {
    const { name, value } = e.target;

    setStudentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();

    if (
      !classForm.name ||
      !classForm.section ||
      !classForm.gradeLevel ||
      !classForm.adviser ||
      !classForm.schoolYear
    ) {
      return;
    }

    if (isCreatingClass) return;

    try {
      setIsCreatingClass(true);

      await createClass({
        name: classForm.name,
        section: classForm.section,
        gradeLevel: Number(classForm.gradeLevel),
        adviser: classForm.adviser,
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
      alert(error.message);
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleInviteStudent = async (e) => {
    e.preventDefault();

    if (
      !selectedClassId ||
      !studentForm.studentId ||
      !studentForm.name ||
      !studentForm.email
    ) {
      return;
    }

    if (isInvitingStudent) return;

    const selectedClass = classes.find(
      (classItem) =>
        String(classItem.id) === String(selectedClassId)
    );

    if (!selectedClass) {
      alert("Selected class was not found.");
      return;
    }

    const duplicateEmail = selectedClass.students?.some(
      (student) =>
        student.email?.toLowerCase() ===
        studentForm.email.toLowerCase()
    );

    if (duplicateEmail) {
      alert("This student is already in the selected class.");
      return;
    }

    try {
      setIsInvitingStudent(true);

      await inviteStudent(selectedClassId, {
        studentId: studentForm.studentId,
        name: studentForm.name,
        email: studentForm.email,
        gradeLevel: selectedClass.gradeLevel,
        section: selectedClass.section,
        schoolYear: selectedClass.schoolYear,
      });

      setShowInviteModal(false);

      setStudentForm({
        studentId: "",
        name: "",
        email: "",
      });
    } catch (error) {
      alert(error.message);
    } finally {
      setIsInvitingStudent(false);
    }
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage classes and their students.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateClassModal}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Class
        </button>
      </div>

      {/* CLASS CARDS */}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {classes.length > 0 ? (
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
                    `/admin/activities?classId=${classItem.id}`
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

              {/* INVITE STUDENT */}
              <button
                type="button"
                onClick={() => openInviteModal(classItem.id)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
              >
                <UserPlus size={17} />
                Invite Student
              </button>

              {/* STUDENTS */}
              {classItem.students?.length > 0 && (
                <div className="mt-5 border-t pt-4">
                  <p className="mb-3 text-sm font-semibold text-gray-700">
                    Students
                  </p>

                  <div className="space-y-3">
                    {classItem.students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                          {student.name
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {student.name}
                          </p>

                          <p className="truncate text-xs text-gray-500">
                            {student.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-lg border bg-white p-10 text-center shadow-sm">
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
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Create Class
                </h2>

                <p className="text-sm text-gray-500">
                  Add a new class.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowClassModal(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateClass}
              className="space-y-4 p-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Class Name
                </label>

                <input
                  name="name"
                  value={classForm.name}
                  onChange={handleClassChange}
                  placeholder="e.g. Grade 10 - ICT A"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Grade Level
                  </label>

                  <select
                    name="gradeLevel"
                    value={classForm.gradeLevel}
                    onChange={handleClassChange}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700">
                    Section
                  </label>

                  <input
                    name="section"
                    value={classForm.section}
                    onChange={handleClassChange}
                    placeholder="ICT A"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Adviser
                </label>

                <input
                  name="adviser"
                  value={classForm.adviser}
                  onChange={handleClassChange}
                  placeholder="Teacher name"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  School Year
                </label>

                <input
                  name="schoolYear"
                  value={classForm.schoolYear}
                  onChange={handleClassChange}
                  placeholder="2026-2027"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreatingClass}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* INVITE STUDENT MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Invite Student
                </h2>

                <p className="text-sm text-gray-500">
                  Add a student to this class.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleInviteStudent}
              className="space-y-4 p-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Student ID
                </label>

                <input
                  name="studentId"
                  value={studentForm.studentId}
                  onChange={handleStudentChange}
                  placeholder="e.g. 2026-0001"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Student Name
                </label>

                <input
                  name="name"
                  value={studentForm.name}
                  onChange={handleStudentChange}
                  placeholder="Juan Dela Cruz"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  name="email"
                  type="email"
                  value={studentForm.email}
                  onChange={handleStudentChange}
                  placeholder="student@example.com"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isInvitingStudent}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isInvitingStudent
                    ? "Inviting..."
                    : "Invite Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminClasses;