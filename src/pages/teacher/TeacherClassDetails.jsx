import { useEffect, useState } from "react";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
  getClasses,
  getStudents,
  addStudentToClassAsTeacher,
} from "../../services/schoolDataService";

function TeacherClassDetails() {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [classesData, studentsData] = await Promise.all([
        getClasses(),
        getStudents(),
      ]);

      const selectedClass = classesData.find(
        (item) => item._id === classId
      );

      if (!selectedClass) {
        setError("Class not found.");
        return;
      }

      setClassData(selectedClass);
      setStudents(studentsData);
    } catch (err) {
      console.error("Failed to load class:", err);
      setError(err.message || "Failed to load class.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  const enrolledStudentIds =
    classData?.students?.map((student) =>
      typeof student === "string"
        ? student
        : student._id
    ) || [];

  const availableStudents = students.filter(
    (student) =>
      !enrolledStudentIds.includes(student._id)
  );

  const enrolledStudents = students.filter((student) =>
    enrolledStudentIds.includes(student._id)
  );

  const handleInvite = async (e) => {
    e.preventDefault();

    if (!selectedStudent) return;

    try {
      setAdding(true);
      setError("");

      const result = await addStudentToClassAsTeacher(
        selectedStudent,
        classId,
        user._id
      );

      setClassData(result.class);
      setSelectedStudent("");
    } catch (err) {
      console.error("Failed to invite student:", err);
      setError(
        err.message || "Failed to add student to class."
      );
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        Loading class...
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-red-500">
          {error || "Class not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/teacher/classes")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back to Classes
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {classData.name}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Section {classData.section} · Grade{" "}
            {classData.gradeLevel} ·{" "}
            {classData.schoolYear}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Invite Student */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <UserPlus size={20} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Invite Student
            </h2>

            <p className="text-sm text-gray-500">
              Add an existing student to this class.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleInvite}
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <select
            value={selectedStudent}
            onChange={(e) =>
              setSelectedStudent(e.target.value)
            }
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">
              Select a student
            </option>

            {availableStudents.map((student) => (
              <option
                key={student._id}
                value={student._id}
              >
                {student.name} — {student.studentId}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!selectedStudent || adding}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus size={17} />

            {adding ? "Adding..." : "Add Student"}
          </button>
        </form>
      </div>

      {/* Students */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 p-6">
          <Users size={20} className="text-blue-600" />

          <div>
            <h2 className="font-semibold text-gray-900">
              Students
            </h2>

            <p className="text-sm text-gray-500">
              {enrolledStudents.length} student
              {enrolledStudents.length !== 1
                ? "s"
                : ""}{" "}
              enrolled
            </p>
          </div>
        </div>

        {enrolledStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No students have been added to this class yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enrolledStudents.map((student) => (
              <div
                key={student._id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {student.name}
                  </p>

                  <p className="text-sm text-gray-500">
                    {student.studentId}
                  </p>
                </div>

                <div className="text-right text-sm text-gray-500">
                  Grade {student.gradeLevel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherClassDetails;