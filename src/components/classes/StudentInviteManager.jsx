import { useState, useMemo, useEffect } from "react";
import {
  Search,
  UserPlus,
  X,
  Check,
  Loader2,
  Users,
  UserCheck,
  AlertCircle,
  Plus,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import {
  getStudents,
  addStudentsToClassAsTeacher,
  addStudentsToClass,
} from "../../services/schoolDataService";

function normalizeGrade(grade) {
  if (grade === undefined || grade === null) return null;
  const num = parseInt(String(grade).replace(/\D/g, ""), 10);
  return isNaN(num) ? String(grade).trim().toLowerCase() : num;
}

export default function StudentInviteManager({
  classData,
  allStudents = null,
  isTeacher = true,
  teacherUserId = "",
  onSuccess = null,
  onClose = null,
}) {
  const { showToast } = useToast();

  const [students, setStudents] = useState(allStudents || []);
  const [loadingStudents, setLoadingStudents] = useState(
    !allStudents || allStudents.length === 0
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [stagedStudents, setStagedStudents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load students if not provided by parent
  useEffect(() => {
    if (allStudents && allStudents.length > 0) {
      setStudents(allStudents);
      setLoadingStudents(false);
      return;
    }

    let isMounted = true;
    async function fetchStudents() {
      try {
        setLoadingStudents(true);
        const data = await getStudents();
        if (isMounted) {
          setStudents(data || []);
        }
      } catch (err) {
        console.error("Failed to load students:", err);
      } finally {
        if (isMounted) {
          setLoadingStudents(false);
        }
      }
    }

    fetchStudents();

    return () => {
      isMounted = false;
    };
  }, [allStudents]);

  // Enrolled student IDs in this class
  const enrolledIds = useMemo(() => {
    return new Set(
      (classData?.students || []).map((s) =>
        String(typeof s === "string" ? s : s._id || s.id)
      )
    );
  }, [classData?.students]);

  const classGrade = normalizeGrade(classData?.gradeLevel);

  // Filter students by grade level and unenrolled status
  const { eligibleStudents, allGradeCount } = useMemo(() => {
    let count = 0;
    const eligible = [];

    students.forEach((s) => {
      const sGrade = normalizeGrade(s.gradeLevel);
      if (sGrade === classGrade) {
        count++;
        const sId = String(s._id || s.id);
        if (!enrolledIds.has(sId)) {
          eligible.push(s);
        }
      }
    });

    return {
      eligibleStudents: eligible,
      allGradeCount: count,
    };
  }, [students, classGrade, enrolledIds]);

  // Filter eligible students by search query (Name, ID, or Email)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleStudents;

    return eligibleStudents.filter((s) => {
      const nameMatch = s.name?.toLowerCase().includes(q);
      const idMatch = s.studentId?.toLowerCase().includes(q);
      const emailMatch = s.email?.toLowerCase().includes(q);
      return nameMatch || idMatch || emailMatch;
    });
  }, [eligibleStudents, searchQuery]);

  // Toggle student in staged list
  const toggleStudent = (student) => {
    const studentId = String(student._id || student.id);
    setStagedStudents((prev) => {
      const exists = prev.some(
        (s) => String(s._id || s.id) === studentId
      );
      if (exists) {
        return prev.filter(
          (s) => String(s._id || s.id) !== studentId
        );
      } else {
        return [...prev, student];
      }
    });
  };

  const removeStaged = (studentId) => {
    setStagedStudents((prev) =>
      prev.filter(
        (s) => String(s._id || s.id) !== String(studentId)
      )
    );
  };

  const clearStaged = () => {
    setStagedStudents([]);
  };

  const selectAllFiltered = () => {
    const newItems = [...stagedStudents];
    filteredStudents.forEach((student) => {
      const studentId = String(student._id || student.id);
      if (!newItems.some((s) => String(s._id || s.id) === studentId)) {
        newItems.push(student);
      }
    });
    setStagedStudents(newItems);
  };

  // Submit invitations
  const handleConfirmInvite = async () => {
    if (stagedStudents.length === 0 || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const studentIds = stagedStudents.map((s) => s._id || s.id);
      const classId = classData._id || classData.id;

      let result;
      if (isTeacher) {
        result = await addStudentsToClassAsTeacher(
          studentIds,
          classId,
          teacherUserId
        );
      } else {
        result = await addStudentsToClass(studentIds, classId);
      }

      showToast(
        `Successfully added ${stagedStudents.length} student${
          stagedStudents.length > 1 ? "s" : ""
        } to ${classData.name}!`,
        "success"
      );

      setStagedStudents([]);
      setSearchQuery("");

      if (onSuccess) {
        onSuccess(result?.class || result);
      }
    } catch (err) {
      console.error("Failed to invite students:", err);
      showToast(err.message || "Failed to invite students.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Target Grade Badge & Description */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50/70 p-3 text-xs text-blue-900 border border-blue-100">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-600 px-2 py-0.5 font-bold text-white uppercase tracking-wider text-[11px]">
            Grade {classData?.gradeLevel}
          </span>
          <span className="font-medium text-gray-700">
            Showing registered Grade {classData?.gradeLevel} students
          </span>
        </div>
        <span className="text-gray-500">
          {eligibleStudents.length} available to invite
          {enrolledIds.size > 0 && ` (${enrolledIds.size} already enrolled)`}
        </span>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name, ID, or email..."
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* ADDING LIST / STAGED STUDENTS (like in modern apps)        */}
      {/* ========================================================= */}
      {stagedStudents.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 transition">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Ready to Invite ({stagedStudents.length})
              </span>
            </div>

            <button
              type="button"
              onClick={clearStaged}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
            >
              Clear all
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {stagedStudents.map((student) => {
              const studentId = student._id || student.id;
              return (
                <span
                  key={studentId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-blue-200 px-3 py-1 text-xs font-medium text-gray-800 shadow-sm"
                >
                  <span className="font-semibold text-blue-950">
                    {student.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    · {student.studentId}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStaged(studentId)}
                    className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STUDENT SELECTION LIST                                    */}
      {/* ========================================================= */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Matching Students ({filteredStudents.length})
          </span>

          {filteredStudents.length > 1 && (
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Select all matching
            </button>
          )}
        </div>

        {loadingStudents ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
            Loading students...
          </div>
        ) : allGradeCount === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500 opacity-80" />
            <p className="font-medium text-gray-700">
              No Grade {classData?.gradeLevel} students found
            </p>
            <p className="mt-1 text-xs text-gray-400">
              There are currently no registered students assigned to Grade{" "}
              {classData?.gradeLevel}.
            </p>
          </div>
        ) : eligibleStudents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            <UserCheck className="mx-auto mb-2 h-8 w-8 text-green-600 opacity-80" />
            <p className="font-medium text-gray-700">
              All Grade {classData?.gradeLevel} students are enrolled!
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Every registered Grade {classData?.gradeLevel} student (
              {allGradeCount}) is already in this class.
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            <Search className="mx-auto mb-2 h-7 w-7 text-gray-400" />
            <p className="font-medium text-gray-700">No matching students</p>
            <p className="mt-1 text-xs text-gray-400">
              No Grade {classData?.gradeLevel} students matched &quot;
              {searchQuery}&quot;. Try searching by name, student ID, or email.
            </p>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-inner">
            {filteredStudents.map((student) => {
              const studentId = String(student._id || student.id);
              const isStaged = stagedStudents.some(
                (s) => String(s._id || s.id) === studentId
              );

              return (
                <div
                  key={studentId}
                  onClick={() => toggleStudent(student)}
                  className={`flex cursor-pointer items-center justify-between p-3 transition hover:bg-blue-50/50 ${
                    isStaged ? "bg-blue-50/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                        isStaged
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {student.name ? student.name[0].toUpperCase() : "S"}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {student.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        <span className="font-medium text-gray-600">
                          {student.studentId}
                        </span>
                        {student.email ? ` · ${student.email}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="ml-3 shrink-0">
                    {isStaged ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                        <Check size={13} />
                        Selected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStudent(student);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
                      >
                        <Plus size={13} />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CONFIRMATION / ACTIONS                                    */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="text-xs text-gray-500">
          {stagedStudents.length > 0 ? (
            <span className="font-medium text-gray-800">
              {stagedStudents.length} student
              {stagedStudents.length !== 1 ? "s" : ""} selected for invitation
            </span>
          ) : (
            <span>Select students above to build your invitation list</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmInvite}
            disabled={stagedStudents.length === 0 || isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                {stagedStudents.length > 0
                  ? `Invite ${stagedStudents.length} Student${
                      stagedStudents.length !== 1 ? "s" : ""
                    }`
                  : "Invite Students"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
