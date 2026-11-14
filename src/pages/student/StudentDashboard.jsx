import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowDownRight, ArrowRight, BookOpen, GraduationCap, MessageSquareText } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getStudentDashboardData } from "../../services/schoolDataService";

function formatDate(value) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatGrade(value) {
  const grade = Number(value);
  return Number.isFinite(grade) ? `${grade.toFixed(1)}%` : "—";
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dashboard, setDashboard] = useState({ subjects: [], recentUpdates: [], currentAverage: null, recentUpdatesCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) return () => { active = false; };
    getStudentDashboardData()
      .then((data) => { if (active) setDashboard(data); })
      .catch((error) => { if (active) showToast(error.message || "Unable to load your dashboard.", "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, showToast]);

  const subjects = dashboard.subjects || [];
  const recentUpdates = dashboard.recentUpdates || [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <section className="min-w-0 rounded-2xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-700 px-4 py-5 text-white shadow-sm sm:px-7 sm:py-6">
        <div className="flex min-w-0 flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100">DNHS-SGMS · Learner portal</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Welcome, {user?.name?.split(" ")[0] || "Student"}</h1>
            <p className="mt-1 text-sm text-blue-100">Here’s your learning snapshot and latest grade progress.</p>
          </div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[390px]">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100">Current average</p>
              <p className="mt-1 text-2xl font-bold">{loading ? "—" : dashboard.currentAverage === null ? "—" : formatGrade(dashboard.currentAverage)}</p>
            </div>
            <Snapshot label="Active subjects" value={loading ? "—" : subjects.length} />
            <Snapshot label="Score updates · 7d" value={loading ? "—" : dashboard.recentUpdatesCount || 0} />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-3">
        <section className="min-w-0 space-y-4 xl:col-span-2">
          <div className="flex items-end justify-between gap-3 px-1">
            <div><h2 className="text-lg font-bold text-slate-900">My Subjects</h2><p className="mt-0.5 text-sm text-slate-500">Your latest published grades and coursework progress.</p></div>
            <Link className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-900" to="/student/grades">All grades <ArrowRight size={15} className="ml-1 inline" /></Link>
          </div>

          {loading ? <div className="grid min-w-0 gap-4 sm:grid-cols-2"><SubjectSkeleton /><SubjectSkeleton /></div> : subjects.length ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {subjects.map((entry) => {
                const assignmentId = entry.subjectAssignment?._id;
                const latest = entry.periods?.[0];
                const total = Number(entry.totalActivities || 0);
                const completed = Number(entry.completedActivities || 0);
                const progress = total ? Math.min(100, Math.round(completed / total * 100)) : 0;
                const cls = entry.class || {};
                const published = latest?.grade?.finalGrade !== undefined && latest?.grade?.finalGrade !== null;
                return (
                  <article id={`subject-${assignmentId}`} key={assignmentId || `${cls._id}-${entry.subject}`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BookOpen size={19} /></span><div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{entry.subject}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{cls.name || "Class"} · Section {cls.section || "—"}</p></div></div>
                      {published ? <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-bold text-emerald-800">{formatGrade(latest.grade.finalGrade)}</span> : <span className={`max-w-[132px] rounded-lg px-2.5 py-1.5 text-center text-[11px] font-semibold leading-4 ${entry.gradeStatus === "awaiting_finalization" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{entry.gradeStatus === "awaiting_finalization" ? "Awaiting Finalization" : "Grade Not Published Yet"}</span>}
                    </div>

                    <p className="mt-3 text-xs text-slate-500">Teacher: <span className="font-medium text-slate-700">{entry.teacher?.name || "Not assigned"}</span>{latest?.academicPeriod?.name ? <span> · {latest.academicPeriod.name}</span> : null}</p>

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="font-medium text-slate-600">Coursework progress</span><span className="text-slate-500">{total ? `${completed} of ${total} scored` : "No activities yet"}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${entry.subject} coursework progress`} aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={completed}><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <Link to={`/student/grades?assignmentId=${encodeURIComponent(assignmentId || "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><GraduationCap size={14} /> View breakdown</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 font-semibold text-slate-800">No subjects assigned yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Your subjects and class activities will appear here once you’re added to a class.</p>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><h2 className="font-bold text-slate-900">Recent grade updates</h2><p className="mt-0.5 text-xs text-slate-500">Recently released scores and feedback</p></div><Activity className="text-violet-700" size={19} /></div>
            {loading ? <WidgetLoading /> : recentUpdates.length ? <div className="divide-y divide-slate-100">{recentUpdates.map((update, index) => <article key={update._id} className="flex gap-3 px-4 py-3.5">
              <div className="flex flex-col items-center"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-violet-600" : "bg-violet-200"}`} />{index < recentUpdates.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}</div>
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-violet-800">{update.subject}</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{update.title}</p></div><span className="shrink-0 rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-violet-800">{update.score}/{update.totalPoints}</span></div>
                {update.feedback && <p className="mt-2 flex gap-1.5 break-words text-xs leading-5 text-slate-600"><MessageSquareText className="mt-0.5 shrink-0 text-slate-400" size={13} />{update.feedback}</p>}
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>{formatDate(update.updatedAt)}</span><Link to={`/student/grades?assignmentId=${encodeURIComponent(update.subjectAssignmentId)}`} className="font-semibold text-blue-700 hover:text-blue-900">Details <ArrowRight size={12} className="ml-0.5 inline" /></Link></div>
              </div>
            </article>)}</div> : <div className="px-4 py-8 text-center"><ArrowDownRight className="mx-auto text-slate-300" size={24} /><p className="mt-2 text-sm font-semibold text-slate-700">No recent grade updates</p><p className="mt-1 text-xs text-slate-500">Released scores and teacher feedback will show here.</p></div>}
            {recentUpdates.length > 0 && <div className="border-t border-slate-100 px-4 py-3"><Link to="/student/grades" className="text-xs font-semibold text-blue-700 hover:text-blue-900">View all grades <ArrowRight size={13} className="ml-1 inline" /></Link></div>}
          </section>

        </aside>
      </div>
    </div>
  );
}

function Snapshot({ label, value }) {
  return <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm"><p className="text-[10px] font-semibold uppercase leading-4 tracking-wider text-blue-100">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function SubjectSkeleton() {
  return <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5"><div className="h-4 w-1/2 rounded bg-slate-100" /><div className="mt-3 h-3 w-2/3 rounded bg-slate-100" /><div className="mt-6 h-2 rounded bg-slate-100" /><div className="mt-5 h-8 w-2/3 rounded bg-slate-100" /></div>;
}

function WidgetLoading() {
  return <div className="space-y-3 p-4"><div className="h-12 animate-pulse rounded-lg bg-slate-100" /><div className="h-12 animate-pulse rounded-lg bg-slate-100" /></div>;
}
