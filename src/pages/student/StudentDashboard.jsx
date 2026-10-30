import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getMyGrades } from "../../services/schoolDataService";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    getMyGrades().then((data) => setSubjects(data || []))
      .catch((error) => showToast(error.message || "Unable to load published grades.", "error"))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  return <div className="space-y-6">
    <section className="rounded-xl bg-blue-700 px-6 py-7 text-white shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">DNHS-SGMS Learner Portal</p>
      <h1 className="mt-2 text-2xl font-bold">Student Dashboard</h1>
      <p className="mt-2 text-sm text-blue-100">Welcome, {user?.name}.</p>
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-blue-700">My Subjects</h2><p className="text-sm text-gray-500">Published grades appear here by subject.</p></div><Link className="text-sm font-medium text-blue-600" to="/student/grades">View all grades</Link></div>
      {loading ? <p className="text-sm text-gray-500">Loading subjects...</p> : subjects.length ? <div className="divide-y">{subjects.map((entry) => {
        const latest = [...(entry.periods || [])].sort((a, b) => new Date(b.finalizedAt || 0) - new Date(a.finalizedAt || 0))[0];
        const cls = entry.class || {};
        return <div key={entry.subjectAssignment?._id || `${cls._id}-${entry.subject}`} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="font-medium text-gray-800">{entry.subject} <span className="font-normal text-gray-500">· {cls.name} {cls.section}</span></p><p className="text-sm text-gray-500">Teacher: {entry.teacher?.name || "Unassigned"}</p></div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{latest?.grade?.finalGrade ?? "Pending"}</span>
        </div>;
      })}</div> : <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-500">No published subject grades are available yet.</p>}
    </section>
  </div>;
}
