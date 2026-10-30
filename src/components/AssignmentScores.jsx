import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getSubjectAssignments, getSubjectAssignmentsByTeacher, getAcademicPeriods,
  getActivitiesByAssignment, getScoresByActivity, saveScore,
  getAssignmentGradebook, getAssignmentGradebookStatus,
  finalizeSubjectGradebook, unlockSubjectGradebook,
} from "../services/schoolDataService";

export default function AssignmentScores({ admin = false }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState(params.get("assignmentId") || "");
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(params.get("periodId") || "");
  const [activities, setActivities] = useState([]);
  const [activityId, setActivityId] = useState(params.get("activityId") || "");
  const [scores, setScores] = useState({});
  const [gradebook, setGradebook] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "scores");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const assignment = assignments.find((item) => String(item._id) === String(assignmentId));
  const cls = assignment?.class || {};
  const requestedStudentId = params.get("studentId") || "";
  const visibleStudents = (cls.students || []).filter((student) => !requestedStudentId || String(student._id || student.id) === requestedStudentId);
  const visibleGradeRows = (gradebook?.grades || []).filter((row) => !requestedStudentId || String(row.studentId) === requestedStudentId);
  const visibleActivities = useMemo(() => activities.filter((item) => String(item.academicPeriod?._id || item.academicPeriod || item.academicPeriodId) === String(periodId)), [activities, periodId]);

  useEffect(() => {
    if (!user?._id) return;
    (admin ? getSubjectAssignments() : getSubjectAssignmentsByTeacher(user._id))
      .then((data) => {
        const list = data || []; setAssignments(list);
        const selected = list.find((item) => String(item._id) === String(params.get("assignmentId"))) || list.find((item) => String(item.class?._id) === String(params.get("classId"))) || list[0];
        setAssignmentId(selected?._id || "");
      }).catch((error) => showToast(error.message || "Unable to load assignments.", "error"))
      .finally(() => setLoading(false));
  }, [user?._id, admin, showToast]);

  useEffect(() => {
    if (!assignment?.class?.schoolYear) { setPeriods([]); setPeriodId(""); return; }
    getAcademicPeriods(assignment.class.schoolYear).then((data) => {
      const list = data || []; setPeriods(list);
      setPeriodId(list.find((item) => String(item._id) === String(params.get("periodId")))?._id || list.find((item) => item.status === "active")?._id || list[0]?._id || "");
    }).catch((error) => showToast(error.message || "Unable to load terms.", "error"));
  }, [assignmentId, assignment?.class?.schoolYear]);

  useEffect(() => {
    if (!assignmentId) { setActivities([]); setActivityId(""); return; }
    getActivitiesByAssignment(assignmentId).then((data) => {
      const list = data || []; setActivities(list);
      setActivityId(list.find((item) => String(item._id) === String(params.get("activityId")))?._id || "");
    }).catch((error) => showToast(error.message || "Unable to load activities.", "error"));
  }, [assignmentId]);

  useEffect(() => {
    if (!activityId) { setScores({}); return; }
    getScoresByActivity(activityId).then((list) => {
      const map = {}; (list || []).forEach((item) => { const id = item.student?._id || item.student; map[id] = { score: item.score, remarks: item.remarks || "" }; }); setScores(map);
    }).catch((error) => showToast(error.message || "Unable to load scores.", "error"));
  }, [activityId]);

  const loadGradebook = useCallback(async () => {
    if (!assignmentId || !periodId) { setGradebook(null); return; }
    try { setBusy(true); const [grades, status] = await Promise.all([getAssignmentGradebook(assignmentId, periodId), getAssignmentGradebookStatus(assignmentId, periodId)]); setGradebook({ ...grades, ...status, grades: grades.grades || [] }); }
    catch (error) { showToast(error.message || "Unable to load subject grades.", "error"); setGradebook(null); }
    finally { setBusy(false); }
  }, [assignmentId, periodId, showToast]);
  useEffect(() => { if (tab === "gradebook") loadGradebook(); }, [tab, loadGradebook]);

  const updateParam = (name, value) => { const next = new URLSearchParams(params); value ? next.set(name, value) : next.delete(name); setParams(next); };
  const saveScores = async () => {
    const activity = activities.find((item) => String(item._id) === String(activityId));
    if (!activity || !assignment) return;
    try {
      setBusy(true);
      for (const student of cls.students || []) {
        const id = student._id || student.id; const raw = scores[id]?.score;
        if (raw === "" || raw === null || raw === undefined) continue;
        const score = Number(raw);
        if (!Number.isFinite(score) || score < 0 || score > Number(activity.totalPoints)) throw new Error(`Score for ${student.name} must be between 0 and ${activity.totalPoints}.`);
        await saveScore({ studentId: id, classId: cls._id, subjectAssignmentId: assignmentId, activityId, score, remarks: scores[id]?.remarks || "" });
      }
      showToast("Scores saved.", "success");
    } catch (error) { showToast(error.message || "Unable to save scores.", "error"); }
    finally { setBusy(false); }
  };
  const finalize = async () => { try { setBusy(true); await finalizeSubjectGradebook(assignmentId, periodId); showToast("Subject grades finalized.", "success"); await loadGradebook(); } catch (error) { showToast(error.message || "Unable to finalize grades.", "error"); } finally { setBusy(false); } };
  const unlock = async () => { try { setBusy(true); await unlockSubjectGradebook(assignmentId, periodId); showToast("Subject grades unlocked.", "success"); await loadGradebook(); } catch (error) { showToast(error.message || "Unable to unlock grades.", "error"); } finally { setBusy(false); } };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading subject assignments...</div>;
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-bold text-gray-900">Scores &amp; Gradebook</h1><p className="text-sm text-gray-500">Scores and finalization are isolated by class and subject.</p></header>
    {!assignments.length ? <div className="rounded-xl border bg-white p-8 text-center text-gray-500">No subject assignments are available.</div> : <>
      <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-3">
        <label className="text-sm font-medium text-gray-700">Class and subject<select value={assignmentId} onChange={(e) => {setAssignmentId(e.target.value); updateParam("assignmentId", e.target.value); setActivityId("");}} className="mt-1 w-full rounded-lg border px-3 py-2.5">{assignments.map((item) => <option key={item._id} value={item._id}>{item.class?.name} · {item.class?.section} — {item.subject}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Term<select value={periodId} onChange={(e) => {setPeriodId(e.target.value); updateParam("periodId", e.target.value);}} className="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="">Select term</option>{periods.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        {tab === "scores" && <label className="text-sm font-medium text-gray-700">Activity<select value={activityId} onChange={(e) => {setActivityId(e.target.value); updateParam("activityId", e.target.value);}} className="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="">Select activity</option>{visibleActivities.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>}
      </section>
      <nav className="flex gap-2"><button onClick={() => setTab("scores")} className={`rounded-lg px-4 py-2 text-sm ${tab === "scores" ? "bg-blue-600 text-white" : "bg-white border"}`}>Score Entry</button><button onClick={() => setTab("gradebook")} className={`rounded-lg px-4 py-2 text-sm ${tab === "gradebook" ? "bg-blue-600 text-white" : "bg-white border"}`}>Gradebook</button></nav>
      {requestedStudentId && <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">Showing progress for {visibleStudents[0]?.name || "selected student"}.</p>}
      {tab === "scores" && (activityId ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[540px]"><thead className="bg-gray-50"><tr><th className="p-4 text-left">Student</th><th className="p-4 text-left">Student ID</th><th className="p-4 text-left">Score</th></tr></thead><tbody className="divide-y">{visibleStudents.map((student) => {const id=student._id||student.id; return <tr key={id}><td className="p-4">{student.name}</td><td className="p-4 text-gray-500">{student.studentId}</td><td className="p-4"><input aria-label={`Score for ${student.name}`} type="number" min="0" max={activities.find((item)=>String(item._id)===String(activityId))?.totalPoints} value={scores[id]?.score ?? ""} onChange={(e)=>setScores((old)=>({...old,[id]:{...old[id],score:e.target.value}}))} className="w-28 rounded border px-3 py-2" /></td></tr>;})}</tbody></table><div className="flex justify-end border-t bg-gray-50 p-4"><button disabled={busy} onClick={saveScores} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Save Scores</button></div></div> : <p className="rounded-xl border border-dashed bg-white p-8 text-center text-gray-500">Choose an activity to enter scores.</p>)}
      {tab === "gradebook" && <section className="space-y-4 rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{cls.name} · {assignment?.subject}</h2><p className="text-sm text-gray-500">{periods.find((item)=>String(item._id)===String(periodId))?.name} · {gradebook?.finalized ? "Finalized" : "Not finalized"}</p></div><div className="flex gap-2">{!requestedStudentId && !gradebook?.finalized && <button disabled={busy || !gradebook?.complete} onClick={finalize} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Finalize grades</button>}{admin && !requestedStudentId && gradebook?.finalized && <button disabled={busy} onClick={unlock} className="rounded-lg border px-4 py-2 text-sm">Unlock grades</button>}</div></div>{gradebook?.missingCategories?.length > 0 && <p className="text-sm text-amber-700">Add activities for: {gradebook.missingCategories.join(", ")}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[500px]"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Student</th><th className="p-3 text-left">Final grade</th></tr></thead><tbody className="divide-y">{visibleGradeRows.map((row) => { const student = (cls.students || []).find((item) => String(item._id || item.id) === String(row.studentId)); return <tr key={row.studentId}><td className="p-3">{student?.name || row.studentId}</td><td className="p-3">{row.finalGrade ?? row.grade?.finalGrade ?? "—"}</td></tr>; })}</tbody></table></div></section>}
    </>}
  </div>;
}
