import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getSubjectAssignmentsByTeacher } from "../../services/schoolDataService";
export default function TeacherClassDetails() {
  const { classId } = useParams(); const { user } = useAuth(); const { showToast } = useToast(); const [assignments,setAssignments]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!user?._id)return;getSubjectAssignmentsByTeacher(user._id).then((data)=>setAssignments((data||[]).filter((item)=>String(item.class?._id)===String(classId)))).catch((error)=>showToast(error.message||"Unable to load subject assignments.","error")).finally(()=>setLoading(false));},[user?._id,classId,showToast]);
  const cls=assignments[0]?.class;
  return <div className="space-y-5"><Link to="/teacher/classes" className="text-sm font-medium text-blue-600">← My Classes</Link><header><h1 className="text-2xl font-bold">{cls?.name||"Class"} · {cls?.section||""}</h1><p className="text-sm text-gray-500">Grade {cls?.gradeLevel} · {cls?.schoolYear}</p></header>{loading?<p className="text-gray-500">Loading subjects...</p>:assignments.length?<section className="divide-y rounded-xl border bg-white">{assignments.map((item)=><div key={item._id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">{item.subject}</h2><p className="text-sm text-gray-500">Teacher: {item.teacher?.name||user?.name}</p></div><div className="flex gap-4 text-sm font-medium text-blue-600"><Link to={`/teacher/activities?assignmentId=${item._id}`}>Activities</Link><Link to={`/teacher/scores?assignmentId=${item._id}`}>Scores</Link></div></div>)}</section>:<p className="rounded-xl border border-dashed bg-white p-8 text-center text-gray-500">No subjects in this class are assigned to you.</p>}</div>;
}
