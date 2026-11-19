import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileSpreadsheet, Cloud } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getSubjectAssignments, getSubjectAssignmentsByTeacher, getAcademicPeriods,
  getActivitiesByAssignment, getScoresByActivity, saveScore,
  getAssignmentGradebook, getAssignmentGradebookStatus,
  finalizeSubjectGradebook, unlockSubjectGradebook,
  getGoogleIntegrationStatus, getGoogleConnectUrl, getAdminGoogleConnectUrl, saveReportToGoogleDrive,
} from "../services/schoolDataService";
import { blobToBase64, downloadBlob } from "../utils/googleFileData";

const formatActivityOption = (activity) => {
  const category = String(activity.gradingCategory || "Activity")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const title = String(activity.title || "Untitled activity");
  return `[${category}] ${title.charAt(0).toUpperCase()}${title.slice(1)} · Max: ${activity.totalPoints} pts`;
};

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
  const [savedScores, setSavedScores] = useState({});
  const [scoreErrors, setScoreErrors] = useState({});
  const scoreInputRefs = useRef({});
  const [gradebook, setGradebook] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "scores");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ available: false, connected: false });
  const [exporting, setExporting] = useState("");
  const assignment = assignments.find((item) => String(item._id) === String(assignmentId));
  const cls = assignment?.class || {};
  const requestedStudentId = params.get("studentId") || "";
  const visibleStudents = (cls.students || []).filter((student) => !requestedStudentId || String(student._id || student.id) === requestedStudentId);
  const visibleGradeRows = (gradebook?.grades || []).filter((row) => !requestedStudentId || String(row.studentId) === requestedStudentId);
  const visibleActivities = useMemo(() => activities.filter((item) => String(item.academicPeriod?._id || item.academicPeriod || item.academicPeriodId) === String(periodId)), [activities, periodId]);
  const activeActivity = activities.find((item) => String(item._id) === String(activityId));
  const scoreErrorsForActivity = scoreErrors[activityId] || {};
  const changedStudentIds = useMemo(
    () => (cls.students || [])
      .filter((student) => {
        const id = student._id || student.id;
        return String(scores[id]?.score ?? "") !== String(savedScores[id]?.score ?? "");
      })
      .map((student) => student._id || student.id),
    [cls.students, scores, savedScores],
  );
  const validateScoreValue = (value, maxScore) => {
    if (value === "" || value === null || value === undefined) return "";
    const numericScore = Number(value);
    if (!Number.isFinite(numericScore)) return "Enter a valid score.";
    if (numericScore < 0) return "Score cannot be below 0.";
    const maximum = Number(maxScore);
    if (!Number.isFinite(maximum)) return "The activity maximum score is unavailable.";
    if (numericScore > maximum) return `Score cannot exceed ${maximum}.`;
    return "";
  };

  const confirmDiscardChanges = () => {
    if (!changedStudentIds.length) return true;
    if (!window.confirm("Discard unsaved score changes and continue?")) return false;
    discardChanges();
    return true;
  };

  const changeActivity = (nextActivityId) => {
    if (nextActivityId === activityId || !confirmDiscardChanges()) return;
    setActivityId(nextActivityId);
    setScores({});
    setSavedScores({});
    updateParam("activityId", nextActivityId);
  };

  const changeTab = (nextTab) => {
    if (nextTab === tab || (tab === "scores" && !confirmDiscardChanges())) return;
    setTab(nextTab);
  };

  const updateVisibleScores = (getScore) => {
    setScores((current) => {
      const next = { ...current };
      for (const student of visibleStudents) {
        const id = student._id || student.id;
        const score = getScore(current[id]?.score);
        if (score !== null) next[id] = { ...current[id], score };
      }
      return next;
    });
    setScoreErrors((current) => {
      const activityErrors = { ...(current[activityId] || {}) };
      for (const student of visibleStudents) {
        activityErrors[student._id || student.id] = "";
      }
      return { ...current, [activityId]: activityErrors };
    });
  };

  const moveScoreFocus = (event, index) => {
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowUp" ? -1 : 1;
    const nextStudent = visibleStudents[index + offset];
    if (nextStudent) {
      scoreInputRefs.current[nextStudent._id || nextStudent.id]?.focus();
    }
  };

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
    let active = true;
    if (!activityId) {
      setScores({});
      setSavedScores({});
      return () => { active = false; };
    }
    getScoresByActivity(activityId).then((list) => {
      if (!active) return;
      const map = {}; (list || []).forEach((item) => { const id = item.student?._id || item.student; map[id] = { score: item.score, remarks: item.remarks || "" }; }); setScores(map); setSavedScores(map);
    }).catch((error) => {
      if (active) showToast(error.message || "Unable to load scores.", "error");
    });
    return () => { active = false; };
  }, [activityId]);

  const loadGradebook = useCallback(async () => {
    if (!assignmentId || !periodId) { setGradebook(null); return; }
    try { setBusy(true); const [grades, status] = await Promise.all([getAssignmentGradebook(assignmentId, periodId), getAssignmentGradebookStatus(assignmentId, periodId)]); setGradebook({ ...grades, ...status, grades: grades.grades || [] }); }
    catch (error) { showToast(error.message || "Unable to load subject grades.", "error"); setGradebook(null); }
    finally { setBusy(false); }
  }, [assignmentId, periodId, showToast]);
  useEffect(() => { if (tab === "gradebook") loadGradebook(); }, [tab, loadGradebook]);
  useEffect(() => { getGoogleIntegrationStatus().then(setGoogleStatus).catch(() => {}); }, []);

  const updateParam = (name, value) => { const next = new URLSearchParams(params); value ? next.set(name, value) : next.delete(name); setParams(next); };
  const saveScores = async () => {
    const activity = activeActivity;
    if (!activity || !assignment) return;
    const errors = {};
    for (const student of cls.students || []) {
      const id = student._id || student.id;
      const error = validateScoreValue(scores[id]?.score, activity.totalPoints);
      if (error) errors[id] = error;
    }
    if (Object.keys(errors).length) {
      setScoreErrors((old) => ({ ...old, [activityId]: errors }));
      showToast("Fix the invalid scores before saving.", "error");
      return;
    }
    try {
      setBusy(true);
      const committedScores = { ...scores };
      for (const student of cls.students || []) {
        const id = student._id || student.id; const raw = scores[id]?.score;
        if (raw === "" || raw === null || raw === undefined) {
          if (savedScores[id]) committedScores[id] = savedScores[id];
          else delete committedScores[id];
          continue;
        }
        const score = Number(raw);
        await saveScore({ studentId: id, classId: cls._id, subjectAssignmentId: assignmentId, activityId, score, remarks: scores[id]?.remarks || "" });
      }
      setScores(committedScores);
      setSavedScores(committedScores);
      setScoreErrors((old) => ({ ...old, [activityId]: {} }));
      showToast("Scores saved.", "success");
    } catch (error) { showToast(error.message || "Unable to save scores.", "error"); }
    finally { setBusy(false); }
  };
  const discardChanges = () => {
    setScores(savedScores);
    setScoreErrors((old) => ({ ...old, [activityId]: {} }));
  };
  const finalize = async () => { try { setBusy(true); await finalizeSubjectGradebook(assignmentId, periodId); showToast("Subject grades finalized.", "success"); await loadGradebook(); } catch (error) { showToast(error.message || "Unable to finalize grades.", "error"); } finally { setBusy(false); } };
  const unlock = async () => { try { setBusy(true); await unlockSubjectGradebook(assignmentId, periodId); showToast("Subject grades unlocked.", "success"); await loadGradebook(); } catch (error) { showToast(error.message || "Unable to unlock grades.", "error"); } finally { setBusy(false); } };

  const exportRows = visibleGradeRows.map((row) => {
    const student = (cls.students || []).find((item) => String(item._id || item.id) === String(row.studentId));
    return [student?.studentId || "", student?.name || row.studentId, row.finalGrade ?? row.grade?.finalGrade ?? "—"];
  });
  const fileBaseName = `${cls.name || "class"}-${assignment?.subject || "subject"}-${periods.find((item) => String(item._id) === String(periodId))?.name || "gradebook"}`
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const createGradebookXlsx = () => {
    const sheet = XLSX.utils.aoa_to_sheet([[`${cls.name} · ${assignment?.subject}`], [`${periods.find((item) => String(item._id) === String(periodId))?.name || ""} Gradebook`], [], ["Student ID", "Student", "Final Grade"], ...exportRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Gradebook");
    return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  };
  const createGradebookPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(`${cls.name} · ${assignment?.subject}`, 40, 40);
    doc.setFontSize(10);
    doc.text(`${periods.find((item) => String(item._id) === String(periodId))?.name || ""} Gradebook`, 40, 58);
    autoTable(doc, {
      startY: 74,
      head: [["Student ID", "Student", "Final Grade"]],
      body: exportRows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    return doc.output("blob");
  };
  const downloadGradebookPdf = () => {
    if (!exportRows.length) return;
    setExporting("pdf");
    try {
      downloadBlob(createGradebookPdf(), `${fileBaseName}.pdf`);
      showToast("Gradebook PDF downloaded.", "success");
    } catch (error) { showToast(error.message || "Unable to export the gradebook.", "error"); }
    finally { setExporting(""); }
  };
  const downloadGradebookXlsx = () => {
    if (!exportRows.length) return;
    setExporting("xlsx");
    try {
      downloadBlob(new Blob([createGradebookXlsx()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBaseName}.xlsx`);
      showToast("Gradebook Excel file downloaded.", "success");
    } catch (error) { showToast(error.message || "Unable to export the gradebook.", "error"); }
    finally { setExporting(""); }
  };
  const exportToGoogleSheets = async () => {
    try {
      setExporting("sheets");
      if (!googleStatus.connected) {
        if (!googleStatus.available) throw new Error("Google Drive is not configured yet. Please contact your administrator.");
        const returnTo = `${window.location.pathname}${window.location.search}`;
        const { authUrl } = await (admin ? getAdminGoogleConnectUrl(returnTo) : getGoogleConnectUrl(returnTo));
        window.location.assign(authUrl);
        return;
      }
      const result = await saveReportToGoogleDrive({
        fileName: `${fileBaseName}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileData: await blobToBase64(new Blob([createGradebookXlsx()])),
        reportType: "subject_gradebook",
        description: `${cls.name} · ${assignment?.subject} gradebook`,
        convertToGoogleSheet: true,
      });
      showToast(result.message || "Gradebook exported to Google Sheets.", "success");
      if (result.webViewLink) window.open(result.webViewLink, "_blank", "noopener,noreferrer");
    } catch (error) { showToast(error.message || "Unable to export to Google Sheets.", "error"); }
    finally { setExporting(""); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading subject assignments...</div>;
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-bold text-gray-900">Scores &amp; Gradebook</h1><p className="text-sm text-gray-500">Scores and finalization are isolated by class and subject.</p></header>
    {!assignments.length ? <div className="rounded-xl border bg-white p-8 text-center text-gray-500">No subject assignments are available.</div> : <>
      <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">Class and subject<select value={assignmentId} onChange={(e) => {if (!confirmDiscardChanges()) return; const next = new URLSearchParams(params); next.set("assignmentId", e.target.value); next.delete("activityId"); setParams(next); setAssignmentId(e.target.value); setActivityId(""); setScores({}); setSavedScores({});}} className="mt-1 w-full rounded-lg border px-3 py-2.5">{assignments.map((item) => <option key={item._id} value={item._id}>{item.class?.name} · {item.class?.section} — {item.subject}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Term<select value={periodId} onChange={(e) => {if (!confirmDiscardChanges()) return; const next = new URLSearchParams(params); e.target.value ? next.set("periodId", e.target.value) : next.delete("periodId"); next.delete("activityId"); setParams(next); setPeriodId(e.target.value); setActivityId(""); setScores({}); setSavedScores({});}} className="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="">Select term</option>{periods.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      </section>
      <nav className="flex gap-2"><button onClick={() => changeTab("scores")} className={`rounded-lg px-4 py-2 text-sm ${tab === "scores" ? "bg-blue-600 text-white" : "bg-white border"}`}>Score Entry</button><button onClick={() => changeTab("gradebook")} className={`rounded-lg px-4 py-2 text-sm ${tab === "gradebook" ? "bg-blue-600 text-white" : "bg-white border"}`}>Gradebook</button></nav>
      {requestedStudentId && <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">Showing progress for {visibleStudents[0]?.name || "selected student"}.</p>}
      {tab === "scores" && <section className="space-y-4 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="min-w-[16rem] flex-1 text-sm font-medium text-gray-700">Activity
            <select value={activityId} onChange={(e) => changeActivity(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5">
              <option value="">Select activity</option>
              {visibleActivities.map((item) => <option key={item._id} value={item._id}>{formatActivityOption(item)}</option>)}
            </select>
          </label>
        </div>
        {activityId && activeActivity ? <div className="rounded-xl border bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left">Student</th>
                <th className="px-4 py-2.5 text-left">Student ID</th>
                <th className="px-4 py-2.5 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Score / Max Score</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {!changedStudentIds.length && <span role="status" className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />All changes saved</span>}
                      <details className="relative font-normal">
                        <summary className="cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Bulk actions</summary>
                        <div className="absolute right-0 top-full z-30 mt-1 flex min-w-44 flex-col rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                          <button type="button" onClick={(event) => {updateVisibleScores((score) => score === "" || score === null || score === undefined ? "0" : null); event.currentTarget.closest("details").open = false;}} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-50">Fill Empty with 0</button>
                          <button type="button" onClick={(event) => {updateVisibleScores(() => String(activeActivity.totalPoints)); event.currentTarget.closest("details").open = false;}} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-50">Set All to Max</button>
                        </div>
                      </details>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleStudents.map((student, index) => {
                const id = student._id || student.id;
                const error = scoreErrorsForActivity[id];
                return <tr key={id} className="odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/60">
                  <td className="px-4 py-2.5">{student.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{student.studentId}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-start gap-2">
                      <div>
                        <input
                          ref={(node) => { scoreInputRefs.current[id] = node; }}
                          aria-label={`Score for ${student.name}`}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `score-error-${id}` : undefined}
                          type="number"
                          min="0"
                          max={activeActivity.totalPoints}
                          step="any"
                          value={scores[id]?.score ?? ""}
                          onKeyDown={(event) => {
                            if (["e", "E", "+", "-"].includes(event.key)) {
                              event.preventDefault();
                            }
                            moveScoreFocus(event, index);
                          }}
                          onChange={(event) => {
                            const value = event.target.value;
                            setScores((old) => ({ ...old, [id]: { ...old[id], score: value } }));
                            setScoreErrors((old) => old[activityId]?.[id]
                              ? { ...old, [activityId]: { ...old[activityId], [id]: validateScoreValue(value, activeActivity.totalPoints) } }
                              : old);
                          }}
                          onBlur={(event) => setScoreErrors((old) => ({
                            ...old,
                            [activityId]: { ...(old[activityId] || {}), [id]: validateScoreValue(event.target.value, activeActivity.totalPoints) },
                          }))}
                          className={`w-24 rounded border px-3 py-2 text-right tabular-nums ${error ? "border-red-500 focus:border-red-500 focus:ring-red-100" : ""}`}
                        />
                        {error && <p id={`score-error-${id}`} className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>}
                      </div>
                      <span className="pt-2 text-sm tabular-nums text-gray-500">/ {activeActivity.totalPoints}</span>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          </div>
          {changedStudentIds.length > 0 && <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-sm font-medium text-slate-700">Unsaved changes for {changedStudentIds.length} {changedStudentIds.length === 1 ? "student" : "students"}</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={discardChanges} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Discard</button>
              <button type="button" disabled={busy} onClick={saveScores} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save Scores</button>
            </div>
          </div>}
        </div> : <p className="rounded-xl border border-dashed bg-white p-8 text-center text-gray-500">{activityId ? "Loading activity..." : "Choose an activity to enter scores."}</p>}
      </section>}
      {tab === "gradebook" && <section className="space-y-4 rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{cls.name} · {assignment?.subject}</h2><p className="text-sm text-gray-500">{periods.find((item)=>String(item._id)===String(periodId))?.name} · {gradebook?.finalized ? "Finalized" : "Not finalized"}</p></div><div className="flex flex-wrap gap-2">{!requestedStudentId && exportRows.length > 0 && <><button type="button" disabled={Boolean(exporting)} onClick={downloadGradebookPdf} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Download size={15} />{exporting === "pdf" ? "Exporting…" : "Export PDF"}</button><button type="button" disabled={Boolean(exporting)} onClick={downloadGradebookXlsx} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><FileSpreadsheet size={15} />{exporting === "xlsx" ? "Exporting…" : "Export Excel"}</button>{googleStatus.available && <button type="button" disabled={Boolean(exporting)} onClick={exportToGoogleSheets} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 disabled:opacity-50"><Cloud size={15} />{exporting === "sheets" ? "Exporting…" : googleStatus.connected ? "Google Sheets" : "Connect Google"}</button>}</>}{!requestedStudentId && !gradebook?.finalized && <button disabled={busy || !gradebook?.complete} onClick={finalize} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Finalize grades</button>}{admin && !requestedStudentId && gradebook?.finalized && <button disabled={busy} onClick={unlock} className="rounded-lg border px-4 py-2 text-sm">Unlock grades</button>}</div></div>{gradebook?.missingCategories?.length > 0 && <p className="text-sm text-amber-700">Add activities for: {gradebook.missingCategories.join(", ")}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[500px]"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Student</th><th className="p-3 text-left">Final grade</th></tr></thead><tbody className="divide-y">{visibleGradeRows.map((row) => { const student = (cls.students || []).find((item) => String(item._id || item.id) === String(row.studentId)); return <tr key={row.studentId}><td className="p-3">{student?.name || row.studentId}</td><td className="p-3">{row.finalGrade ?? row.grade?.finalGrade ?? "—"}</td></tr>; })}</tbody></table></div></section>}
    </>}
  </div>;
}
