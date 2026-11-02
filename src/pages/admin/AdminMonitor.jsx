import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Download, FileSearch, RefreshCw, Search, Settings2, ShieldCheck, X } from "lucide-react";
import { exportAuditLogs, getAuditLogDetail, getAuditLogs } from "../../services/schoolDataService";

const INITIAL_FILTERS = { search: "", category: "all", role: "all", timeframe: "all", startDate: "", endDate: "" };
const CATEGORY_LABELS = { grades: "Grades", classes: "Classes", activities: "Activities", students: "Students", accounts: "Accounts", calendar: "Calendar", system: "System" };
const ROLE_LABELS = { admin: "Administrator", teacher: "Faculty Teacher", student: "Student" };

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function titleCase(value = "") {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadCsv(blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `DNHS-SGMS-Audit-Logs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getEntityHref(log) {
  const id = log.target?.entityId;
  const details = log.details || {};
  switch (log.target?.entityType) {
    case "Class":
    case "ClassRoster":
      return id ? `/admin/classes/${id}` : null;
    case "Student":
      return id ? `/admin/accounts/students?studentId=${encodeURIComponent(id)}` : null;
    case "User": {
      const role = details.role || log.actor?.role;
      return id && ["admin", "teacher", "student"].includes(role) ? `/admin/accounts/${role}/${id}/edit` : "/admin/accounts";
    }
    case "AcademicPeriod":
      return "/admin/academic-calendar";
    case "IntegrationSetting":
      return "/admin/integrations";
    case "Activity":
      return "/admin/activities";
    case "SubjectGradebook": {
      const assignmentId = details.subjectAssignmentId || details.assignmentId;
      const periodId = details.periodId;
      return assignmentId && periodId ? `/admin/scores?assignmentId=${encodeURIComponent(assignmentId)}&periodId=${encodeURIComponent(periodId)}&tab=gradebook` : "/admin/scores";
    }
    case "ClassGradebook":
      return details.classId ? `/admin/scores?classId=${encodeURIComponent(details.classId)}&periodId=${encodeURIComponent(details.periodId || "")}&tab=gradebook` : "/admin/scores";
    case "Gradebook":
      return details.classId ? `/admin/classes/${encodeURIComponent(details.classId)}` : "/admin/scores";
    case "SubjectAssignment":
      return id ? `/admin/scores?assignmentId=${encodeURIComponent(id)}` : "/admin/classes";
    default:
      return null;
  }
}

function StatusBadge({ log }) {
  const historicalUnknownActor = log.details?.historicalBackfill && log.details?.actorKnown === false;
  const status = historicalUnknownActor ? "warning" : (log.status || "success");
  const reason = log.details?.failureReason || log.details?.error || log.details?.reason || (historicalUnknownActor ? "Historical record imported without original actor information." : "");
  const styles = {
    success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    failed: "bg-red-100 text-red-800 ring-red-200",
    warning: "bg-amber-100 text-amber-900 ring-amber-300",
  };
  return <span title={reason || titleCase(status)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.success}`}>{status === "warning" || status === "failed" ? <CircleAlert size={13} /> : null}{titleCase(status)}</span>;
}

function ActorCell({ actor }) {
  const isSystem = actor?.role === "system" || !actor?.user;
  if (isSystem) {
    return <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Settings2 size={14} className="text-slate-500" />System</span>;
  }
  const role = ROLE_LABELS[actor?.role] || titleCase(actor?.role || "User");
  return <div className="min-w-[150px]"><div className="font-semibold text-slate-800">{actor?.name || "Unknown user"}</div><span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">{role}</span></div>;
}

export default function AdminMonitor() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [query, setQuery] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ logs: [], pagination: { total: 0, totalPages: 1 }, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const requestSequence = useRef(0);

  const loadLogs = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await getAuditLogs({ ...query, page, limit: pageSize });
      if (sequence === requestSequence.current) setData(result);
    } catch (err) {
      if (sequence === requestSequence.current) setError(err.message || "Unable to load the audit trail.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [page, pageSize, query]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery((current) => current.search === filters.search.trim() ? current : { ...current, search: filters.search.trim() });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key !== "search") {
      setPage(1);
      setQuery((current) => ({ ...current, [key]: value }));
    }
  };

  const showDetail = async (log) => {
    setSelectedLog(log);
    setDetailLoading(true);
    try { setSelectedLog(await getAuditLogDetail(log._id)); }
    catch { /* The list entry still contains useful details. */ }
    finally { setDetailLoading(false); }
  };

  const exportLogs = async () => {
    try {
      const blob = await exportAuditLogs(query);
      downloadCsv(blob);
    } catch (err) { setError(err.message || "Unable to export audit records."); }
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setQuery(INITIAL_FILTERS);
    setPage(1);
  };

  const statCards = [
    { label: "Actions today", value: data.stats?.todayCount ?? 0, subtext: "Recorded since midnight", icon: Activity },
    { label: "Grade actions", value: data.stats?.gradesCount ?? 0, subtext: "All recorded grade changes", icon: ShieldCheck },
    { label: "Gradebook lock events", value: data.stats?.gradebookCount ?? 0, subtext: "Finalizations and unlocks recorded", icon: FileSearch },
    { label: "All recorded actions", value: data.stats?.totalAll ?? 0, subtext: "Lifetime audit records", icon: CalendarDays },
  ];

  const totalPages = data.pagination?.totalPages || 1;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700"><ShieldCheck size={17} /> Administration</div>
          <h1 className="text-2xl font-bold text-gray-900">Activity monitor</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">Review changes made across grades, classes, accounts, and school settings. Read-only activity is excluded.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLogs} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
          <button onClick={exportLogs} disabled={!data.logs?.length} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} /> Export CSV</button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, subtext, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span><Icon size={18} className="text-blue-700" /></div><div className="mt-2 text-2xl font-bold text-slate-900">{Number(value).toLocaleString()}</div><p className="mt-1 text-xs text-slate-500">{subtext}</p></div>)}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-800">Filter this audit table</h2><p className="mt-0.5 text-xs text-slate-500">These filters only narrow the activity records shown below.</p></div><button type="button" onClick={resetFilters} className="rounded-lg px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50">Clear filters</button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">Search this audit table</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700" /><input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Filter audit records: person, action, record" className="w-full rounded-lg border border-blue-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
            <label><span className="sr-only">Category</span><select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="all">All categories</option>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label><span className="sr-only">Actor role</span><select value={filters.role} onChange={(e) => updateFilter("role", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="all">All roles</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="system">System</option></select></label>
            <label><span className="sr-only">Time period</span><select value={filters.timeframe} onChange={(e) => updateFilter("timeframe", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="all">Any time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select></label>
          </div>
        </div>

        {error && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3 font-semibold">Action &amp; record</th><th className="px-4 py-3 font-semibold">Who</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">When</th><th className="px-4 py-3 font-semibold">Status</th><th className="sticky right-0 bg-slate-100 px-4 py-3 text-right font-semibold">Details</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Loading activity…</td></tr> : data.logs?.length ? data.logs.map((log) => {
                const entityHref = getEntityHref(log);
                return <tr key={log._id} className="hover:bg-slate-50/80"><td className="max-w-[390px] px-4 py-3"><div className="font-semibold text-slate-800">{titleCase(log.action)}</div><div className="mt-0.5 truncate text-slate-600">{log.description}</div>{log.target?.name && <div className="mt-1 truncate text-xs">{entityHref ? <button type="button" onClick={() => navigate(entityHref)} className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">Record: {log.target.name}</button> : <span className="text-slate-500">Record: {log.target.name}</span>}</div>}</td><td className="px-4 py-3"><ActorCell actor={log.actor} /></td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{CATEGORY_LABELS[log.category] || titleCase(log.category)}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(log.createdAt)}</td><td className="px-4 py-3"><StatusBadge log={log} /></td><td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"><button onClick={() => showDetail(log)} className="rounded-md px-2.5 py-1.5 font-semibold text-blue-800 hover:bg-blue-50">Details</button></td></tr>;
              }) : <tr><td colSpan="6" className="px-4 py-14 text-center"><div className="mx-auto flex max-w-sm flex-col items-center text-slate-500"><FileSearch size={30} className="mb-3 text-slate-300" /><div className="font-semibold text-slate-700">No activity found</div><p className="mt-1 text-sm">Try another search or filter. New changes will appear here as they are recorded.</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">Rows per page<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
          <div className="flex items-center gap-3"><span className="text-sm font-medium text-slate-700">Page {page} of {totalPages}</span><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">&lt; Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next &gt;</button></div>
        </footer>
      </section>

      {selectedLog && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setSelectedLog(null)}><aside role="dialog" aria-modal="true" aria-label="Audit record details" onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-sm font-medium text-blue-700">Audit record</div><h2 className="mt-1 text-xl font-bold text-slate-900">{titleCase(selectedLog.action)}</h2></div><button onClick={() => setSelectedLog(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close details"><X size={19} /></button></div>{detailLoading && <p className="mt-3 text-xs text-slate-400">Loading full record…</p>}<p className="mt-4 text-sm text-slate-600">{selectedLog.description}</p><dl className="mt-6 divide-y divide-slate-100">{[["Actor", selectedLog.actor?.name], ["Email", selectedLog.actor?.email], ["Role", ROLE_LABELS[selectedLog.actor?.role] || titleCase(selectedLog.actor?.role)], ["Date and time", formatDate(selectedLog.createdAt)], ["Category", CATEGORY_LABELS[selectedLog.category] || titleCase(selectedLog.category)], ["Target", selectedLog.target?.name], ["Record type", selectedLog.target?.entityType], ["Record ID", selectedLog.target?.entityId], ["IP address", selectedLog.ipAddress], ["Status", titleCase(selectedLog.status || "success")]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-3 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="break-words font-medium text-slate-800">{value}</dd></div>)}</dl>{selectedLog.details && Object.keys(selectedLog.details).length > 0 && <div className="mt-5"><h3 className="text-sm font-semibold text-slate-800">Change details</h3><pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(selectedLog.details, null, 2)}</pre></div>}</aside></div>}
    </div>
  );
}
