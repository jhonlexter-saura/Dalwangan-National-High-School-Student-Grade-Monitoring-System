import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getSubjectAssignmentsByTeacher } from "../../services/schoolDataService";

function TeacherDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) return;
    getSubjectAssignmentsByTeacher(user._id)
      .then((data) => setAssignments(data || []))
      .catch((error) => showToast(error.message || "Unable to load teaching assignments.", "error"))
      .finally(() => setLoading(false));
  }, [user?._id, showToast]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-blue-700 px-6 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">DNHS-SGMS Faculty Portal</p>
        <h1 className="mt-2 text-2xl font-bold">Teacher Dashboard</h1>
        <p className="mt-2 text-sm text-blue-100">Welcome, {user?.name}.</p>
      </section>
      <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div><h2 className="font-semibold text-blue-700">My Class–Subject Assignments</h2><p className="text-sm text-gray-500">Only subjects assigned to you are shown.</p></div>
        {loading ? <p className="text-sm text-gray-500">Loading assignments...</p> : assignments.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((assignment) => {
              const cls = assignment.class || {};
              const label = `${cls.name || "Class"} · ${cls.section || ""} · ${assignment.subject}`;
              return <article key={assignment._id} className="rounded-lg border p-4">
                <h3 className="font-medium text-gray-800">{label}</h3>
                <p className="mt-1 text-sm text-gray-500">Grade {cls.gradeLevel} · {cls.schoolYear}</p>
                <div className="mt-4 flex gap-4 text-sm font-medium text-blue-600">
                  <Link to={`/teacher/activities?assignmentId=${assignment._id}`}>Activities</Link>
                  <Link to={`/teacher/scores?assignmentId=${assignment._id}`}>Scores &amp; grades</Link>
                </div>
              </article>;
            })}
          </div>
        ) : <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-500">No subject assignments have been made for you yet.</p>}
      </section>
    </div>
  );
}

export default TeacherDashboard;
