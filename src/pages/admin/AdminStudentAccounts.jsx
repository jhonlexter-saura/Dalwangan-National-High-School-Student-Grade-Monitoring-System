import { useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  Search,
  Users,
  GraduationCap,
  UserRoundPlus,
  X,
  Pencil,
  Power,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getStudents,
  addStudentToClass,
  updateStudentAccountStatus,
} from "../../services/schoolDataService";

import { useSchoolData } from "../../context/SchoolDataContext";
import { useToast } from "../../context/ToastContext";

export default function AdminStudentAccounts() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    classes,
    loading: classesLoading,
    reloadData,
  } = useSchoolData();

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState("all");
  const [search, setSearch] = useState("");

  const [assignStudent, setAssignStudent] = useState(null);
  const [assignClassId, setAssignClassId] = useState("");

  const [assigning, setAssigning] = useState(false);
  const [updatingStudentId, setUpdatingStudentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // -----------------------------------------
  // Load students
  // -----------------------------------------

  const loadStudents = async () => {
    try {
      setStudentsLoading(true);

      const data = await getStudents();

      setStudents(data);
    } catch (err) {
      console.error("Failed to load students:", err);
      setError(err.message || "Failed to load students.");
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  // -----------------------------------------
  // Determine each student's class
  // -----------------------------------------

  const studentRows = useMemo(() => {
    return students.map((student) => {
      const studentClass = classes.find((schoolClass) =>
        (schoolClass.students || []).some(
          (classStudent) =>
            classStudent.id === student._id ||
            classStudent._id === student._id
        )
      );

      return {
        ...student,

        classId: studentClass?.id || null,
        className: studentClass?.name || null,
        classSection: studentClass?.section || null,
        classGradeLevel: studentClass?.gradeLevel || null,
      };
    });
  }, [students, classes]);

  // -----------------------------------------
  // Filter students
  // -----------------------------------------

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return studentRows.filter((student) => {
      let matchesClass = true;

      if (selectedClass === "unassigned") {
        matchesClass = !student.classId;
      } else if (selectedClass !== "all") {
        matchesClass = student.classId === selectedClass;
      }

      const matchesSearch =
        !query ||
        student.name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.studentId?.toLowerCase().includes(query);

      return matchesClass && matchesSearch;
    });
  }, [studentRows, selectedClass, search]);

  // -----------------------------------------
  // Assign student to class
  // -----------------------------------------

  const handleAssignStudent = async () => {
    if (!assignStudent || !assignClassId) {
      setError("Please select a class.");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setMessage("");

      await addStudentToClass(
        assignStudent._id,
        assignClassId
      );

      setMessage(
        `${assignStudent.name} was assigned to the class successfully.`
      );

      setAssignStudent(null);
      setAssignClassId("");

      // Refresh both students and class data
      await loadStudents();
      await reloadData();
    } catch (err) {
      console.error("Failed to assign student:", err);

      setError(
        err.message || "Failed to assign student to class."
      );
    } finally {
      setAssigning(false);
    }
  };

  const openAssignModal = (student) => {
    setError("");
    setMessage("");
    setAssignClassId("");
    setAssignStudent(student);
  };

  const closeAssignModal = () => {
    if (assigning) return;

    setAssignStudent(null);
    setAssignClassId("");
  };

  const handleToggleStudentStatus = async (student) => {
    const status = student.status === "active" ? "inactive" : "active";
    if (
      status === "inactive" &&
      !window.confirm(`Deactivate ${student.name}'s account?`)
    ) {
      return;
    }
    try {
      setUpdatingStudentId(student._id);
      setError("");
      const updatedStudent = await updateStudentAccountStatus(student._id, status);
      setStudents((current) =>
        current.map((item) =>
          item._id === updatedStudent._id ? updatedStudent : item
        )
      );
      showToast(
        `Student account ${status === "active" ? "activated" : "deactivated"}.`,
        "success"
      );
    } catch (statusError) {
      console.error("Failed to update student account status:", statusError);
      setError(statusError.message || "Failed to update account status.");
    } finally {
      setUpdatingStudentId("");
    }
  };

  const loading = classesLoading || studentsLoading;

  return (
    <>
      <div className="space-y-6">
        {/* -------------------------------- */}
        {/* Header */}
        {/* -------------------------------- */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Student Accounts
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage student accounts and class assignments.
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/admin/accounts/students/create")
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <UserPlus size={18} />

            Create Student Account
          </button>
        </div>

        {/* -------------------------------- */}
        {/* Messages */}
        {/* -------------------------------- */}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* -------------------------------- */}
        {/* Summary */}
        {/* -------------------------------- */}

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<Users size={20} />}
            label="Total Students"
            value={students.length}
            iconClass="bg-blue-100 text-blue-600"
          />

          <SummaryCard
            icon={<GraduationCap size={20} />}
            label="Assigned Students"
            value={
              studentRows.filter(
                (student) => student.classId
              ).length
            }
            iconClass="bg-green-100 text-green-600"
          />

          <SummaryCard
            icon={<UserRoundPlus size={20} />}
            label="Unassigned"
            value={
              studentRows.filter(
                (student) => !student.classId
              ).length
            }
            iconClass="bg-yellow-100 text-yellow-600"
          />
        </div>

        {/* -------------------------------- */}
        {/* Filters */}
        {/* -------------------------------- */}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Class filter */}
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Filter by Class
              </label>

              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(e.target.value)
                }
                className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">
                  All Classes
                </option>

                <option value="unassigned">
                  Unassigned Students
                </option>

                {classes.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    Grade {schoolClass.gradeLevel} -{" "}
                    {schoolClass.section}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Search Student
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search name, ID, or email..."
                  className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* -------------------------------- */}
        {/* Student List */}
        {/* -------------------------------- */}

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Student Accounts
            </h2>

            <p className="text-sm text-gray-500">
              {filteredStudents.length} student
              {filteredStudents.length !== 1
                ? "s"
                : ""}{" "}
              shown
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading student accounts...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-gray-300" />

              <h3 className="mt-3 font-medium text-gray-900">
                No students found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Try changing the class filter or search.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Class</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((student) => (
                    <StudentRow
                      key={student._id}
                      student={student}
                      onAssign={openAssignModal}
                      onEdit={() =>
                        navigate(
                          `/admin/accounts/students/${student._id}/edit`
                        )
                      }
                      onToggleStatus={handleToggleStudentStatus}
                      statusUpdating={updatingStudentId === student._id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------- */}
      {/* Assign Student Modal */}
      {/* -------------------------------- */}

      {assignStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Assign Student
                </h2>

                <p className="text-sm text-gray-500">
                  Assign this student to a class.
                </p>
              </div>

              <button
                onClick={closeAssignModal}
                disabled={assigning}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Student Info */}
            <div className="border-b px-5 py-4">
              <p className="font-medium text-gray-900">
                {assignStudent.name}
              </p>

              <p className="text-sm text-gray-500">
                ID: {assignStudent.studentId}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Select Class
                </label>

                <select
                  value={assignClassId}
                  onChange={(e) =>
                    setAssignClassId(e.target.value)
                  }
                  disabled={assigning}
                  className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Select a class
                  </option>

                  {classes.map((schoolClass) => (
                    <option
                      key={schoolClass.id}
                      value={schoolClass.id}
                    >
                      Grade {schoolClass.gradeLevel} -{" "}
                      {schoolClass.section}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  disabled={assigning}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAssignStudent}
                  disabled={
                    assigning || !assignClassId
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assigning
                    ? "Assigning..."
                    : "Assign Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/*
 * -----------------------------------------
 * Summary Card
 * -----------------------------------------
 */

function SummaryCard({
  icon,
  label,
  value,
  iconClass,
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </div>

        <div>
          <p className="text-sm text-gray-500">
            {label}
          </p>

          <p className="text-2xl font-bold text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/*
 * -----------------------------------------
 * Student Row
 * -----------------------------------------
 */

function StudentRow({ student, onAssign, onEdit, onToggleStatus, statusUpdating }) {
  const assigned = Boolean(student.classId);

  return (
    <tr className="transition hover:bg-gray-50">
      <td className="px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
            {student.name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <p className="max-w-[260px] truncate font-medium text-gray-900" title={student.name}>
            {student.name}
          </p>
        </div>
      </td>
      <td className="px-5 py-4">
        {assigned ? (
          <p className="max-w-[180px] break-words text-sm text-gray-700">
            Grade {student.classGradeLevel} - {student.classSection}
          </p>
        ) : (
          <span className="inline-flex whitespace-nowrap rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
            Unassigned
          </span>
        )}
      </td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
            student.status === "inactive"
              ? "bg-gray-100 text-gray-600"
              : "bg-green-100 text-green-700"
          }`}
        >
          {student.status === "inactive"
            ? "Inactive"
            : "Active"}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex min-w-[300px] justify-end gap-2">
          <button
            type="button"
            onClick={() => onToggleStatus(student)}
            disabled={statusUpdating}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              student.status === "inactive"
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            <Power size={16} />
            {statusUpdating
              ? "Saving..."
              : student.status === "inactive"
                ? "Activate"
                : "Deactivate"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <Pencil size={16} />
            Edit
          </button>

          <button
            type="button"
            onClick={() => onAssign(student)}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            <UserRoundPlus size={16} />
            {assigned ? "Reassign" : "Assign"}
          </button>
        </div>
      </td>
    </tr>
  );
}
