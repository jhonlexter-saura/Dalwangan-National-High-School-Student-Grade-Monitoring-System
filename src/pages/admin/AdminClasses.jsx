import { useState } from "react";
import { useSchoolData } from "../../context/SchoolDataContext";

import {
  Plus,
  Users,
  X,
  UserPlus,
  Mail,
} from "lucide-react";

function AdminClasses() {
  const { classes, createClass, inviteStudent } = useSchoolData();

  const [showClassModal, setShowClassModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState(null);

  const [classForm, setClassForm] = useState({
    name: "",
    adviser: "",
    schoolYear: "2026-2027",
  });

  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
  });

  // -----------------------------
  // Class Form
  // -----------------------------

  const handleClassChange = (e) => {
    const { name, value } = e.target;

    setClassForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateClass = (e) => {
    e.preventDefault();

    if (!classForm.name || !classForm.adviser) {
      return;
    }

    createClass({
        name: classForm.name,
        adviser: classForm.adviser,
        schoolYear: classForm.schoolYear,
    });

    setClassForm({
        name: "",
        adviser: "",
        schoolYear: "2026-2027",
    });

    setShowClassModal(false);
  };

  // -----------------------------
  // Student Form
  // -----------------------------

  const handleStudentChange = (e) => {
    const { name, value } = e.target;

    setStudentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInviteStudent = (e) => {
    e.preventDefault();

    if (!studentForm.name || !studentForm.email) {
      return;
    }

    inviteStudent(selectedClassId, {
        name: studentForm.name,
        email: studentForm.email,
    });

    setStudentForm({
      name: "",
      email: "",
    });

    setShowInviteModal(false);
  };

  const openInviteModal = (classId) => {
    setSelectedClassId(classId);
    setShowInviteModal(true);
  };

  return (
    <div>
      {/* =========================
          PAGE HEADER
      ========================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create classes and invite students.
          </p>
        </div>

        <button
          onClick={() => setShowClassModal(true)}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Class
        </button>
      </div>

      {/* =========================
          CLASS LIST
      ========================== */}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((classItem) => (
          <div
            key={classItem.id}
            className="rounded-lg border bg-white p-5 shadow-sm"
          >
            {/* Class information */}

            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">
                  {classItem.name}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {classItem.schoolYear}
                </p>
              </div>

              <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                <Users size={20} />
              </div>
            </div>

            {/* Adviser */}

            <div className="mt-5 border-t pt-4">
              <p className="text-sm text-gray-500">
                Adviser
              </p>

              <p className="mt-1 text-sm font-medium text-gray-800">
                {classItem.adviser}
              </p>
            </div>

            {/* Student count */}

            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Users size={16} />

              <span>
                {classItem.students.length} students
              </span>
            </div>

            {/* Invite button */}

            <button
              onClick={() => openInviteModal(classItem.id)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
            >
              <UserPlus size={17} />
              Invite Student
            </button>

            {/* Students */}

            {classItem.students.length > 0 && (
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                        {student.name
                          .charAt(0)
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
        ))}
      </div>

      {/* =========================
          CREATE CLASS MODAL
      ========================== */}

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
                onClick={() => setShowClassModal(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateClass}
              className="space-y-5 p-6"
            >
              <div>
                <label
                  htmlFor="class-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Class Name
                </label>

                <input
                  id="class-name"
                  name="name"
                  type="text"
                  value={classForm.name}
                  onChange={handleClassChange}
                  placeholder="e.g. Grade 10 - ICT B"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="class-adviser"
                  className="block text-sm font-medium text-gray-700"
                >
                  Adviser
                </label>

                <input
                  id="class-adviser"
                  name="adviser"
                  type="text"
                  value={classForm.adviser}
                  onChange={handleClassChange}
                  placeholder="e.g. Pedro Cruz"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="class-school-year"
                  className="block text-sm font-medium text-gray-700"
                >
                  School Year
                </label>

                <select
                  id="class-school-year"
                  name="schoolYear"
                  value={classForm.schoolYear}
                  onChange={handleClassChange}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="2026-2027">
                    2026-2027
                  </option>

                  <option value="2025-2026">
                    2025-2026
                  </option>
                </select>
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
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================
          INVITE STUDENT MODAL
      ========================== */}

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
                onClick={() => setShowInviteModal(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleInviteStudent}
              className="space-y-5 p-6"
            >
              <div>
                <label
                  htmlFor="student-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Student Name
                </label>

                <input
                  id="student-name"
                  name="name"
                  type="text"
                  value={studentForm.name}
                  onChange={handleStudentChange}
                  placeholder="e.g. Juan Dela Cruz"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="student-email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Student Email
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="student-email"
                    name="email"
                    type="email"
                    value={studentForm.email}
                    onChange={handleStudentChange}
                    placeholder="student@example.com"
                    className="mt-1 w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                The student will be added to the selected class.
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
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <UserPlus size={17} />
                  Invite Student
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