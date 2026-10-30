import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getSubjectAssignmentsByTeacher } from "../../services/schoolDataService";

export default function TeacherClasses() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?._id) return;
    getSubjectAssignmentsByTeacher(user._id)
      .then((data) => setAssignments(data || []))
      .catch((error) => showToast(error.message || "Unable to load assignments.", "error"))
      .finally(() => setLoading(false));
  }, [user?._id, showToast]);

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-gray-900">My Classes</h1><p className="mt-1 text-sm text-gray-500">Classes and subjects assigned to you.</p></header>
    {loading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">Loading assignments...</div> : assignments.length ?
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{assignments.map((assignment) => {
        const cls = assignment.class || {};
        return <article key={assignment._id} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-blue-100 p-2"><GraduationCap className="h-5 w-5 text-blue-600" /></div><div><h2 className="font-semibold text-gray-900">{cls.name} · {cls.section}</h2><p className="text-sm text-gray-500">Grade {cls.gradeLevel} · {cls.schoolYear}</p></div></div>
          <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">{assignment.subject}</p>
          <div className="mt-4 flex gap-4 text-sm font-medium text-blue-600"><Link to={`/teacher/activities?assignmentId=${assignment._id}`}>Activities</Link><Link to={`/teacher/scores?assignmentId=${assignment._id}`}>Scores</Link></div>
        </article>;
      })}</div> : <div className="rounded-xl border border-dashed bg-white p-10 text-center"><GraduationCap className="mx-auto h-10 w-10 text-gray-400"/><h2 className="mt-3 font-semibold text-gray-800">No assignments yet</h2><p className="mt-1 text-sm text-gray-500">Ask an administrator to assign you a class subject.</p></div>}
  </div>;
}
