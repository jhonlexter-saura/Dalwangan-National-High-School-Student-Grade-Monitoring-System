import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarDays, Check, ChevronDown, CircleAlert, Cloud, Copy, Download, FileSearch, RefreshCw, Search, Settings2, ShieldCheck, X } from "lucide-react";
import { exportAuditLogs, exportReportToGoogleSheets, getAuditLogDetail, getAuditLogExportData, getAuditLogs, getAdminGoogleConnectUrl, getGoogleIntegrationStatus, saveReportToGoogleDrive } from "../../services/schoolDataService";
import { adminAuditRowsForSheets, createAdminAuditPdf, createAdminAuditXlsx, downloadAdminAuditPdf, downloadAdminAuditXlsx } from "../../utils/adminAuditExports";
import { useToast } from "../../context/ToastContext";
import { blobToBase64 } from "../../utils/googleFileData";

const INITIAL_FILTERS = { search: "", category: "all", role: "all", timeframe: "all", startDate: "", endDate: "" };
const CATEGORY_LABELS = { grades: "Grades", classes: "Classes", activities: "Activities", students: "Students", accounts: "Accounts", calendar: "Calendar", system: "System" };
const ROLE_LABELS = { admin: "Administrator", teacher: "Faculty Teacher", student: "Student" };
const PENDING_DRIVE_EXPORT_KEY = "admin-monitor-pending-drive-export";

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
  const rateLimited = log.action?.includes("RATE_LIMITED") || log.action === "ACCOUNT_SIGN_IN_DELAYED";
  const reason = log.details?.failureReason || log.details?.error || log.details?.reason || (historicalUnknownActor ? "Historical record imported without original actor information." : "");
  const styles = {
    success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    failed: "bg-red-100 text-red-800 ring-red-200",
    warning: "bg-amber-100 text-amber-900 ring-amber-300",
  };
  return <span title={reason || titleCase(status)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.success}`}>{status === "warning" || status === "failed" ? <CircleAlert size={13} /> : null}{rateLimited ? "Rate Limited" : titleCase(status)}</span>;
}

function isFailedLogin(log) {
  return log.status === "failed" && (log.action === "USER_LOGIN" || /failed sign-in/i.test(log.description || ""));
}

function groupFailedLogins(logs) {
  const grouped = [];
  for (const log of logs || []) {
    const key = isFailedLogin(log) ? [log.actor?.email || log.details?.attemptedIdentifierHash || log.ipAddress || "unknown", log.action, log.description].join("|") : "";
    const previous = grouped[grouped.length - 1];
    if (key && previous?.groupKey === key) {
      previous.logs.push(log);
      previous.log = { ...previous.log, createdAt: log.createdAt };
    } else {
      grouped.push({ log, logs: [log], groupKey: key });
    }
  }
  return grouped;
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
  const { showToast } = useToast();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [query, setQuery] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ logs: [], pagination: { total: 0, totalPages: 1 }, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [openExportMenu, setOpenExportMenu] = useState("");
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ available: false, connected: false });
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

  useEffect(() => { void Promise.resolve().then(loadLogs); }, [loadLogs]);

  useEffect(() => {
    getGoogleIntegrationStatus().then(setGoogleStatus).catch(() => {});
  }, []);

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

  const exportLogs = async (format) => {
    try {
      setExportingFormat(format);
      setError("");
      if (format === "csv") {
        const blob = await exportAuditLogs(query);
        downloadCsv(blob);
      } else {
        const { logs } = await getAuditLogExportData(query);
        if (format === "xlsx") downloadAdminAuditXlsx({ logs });
        else downloadAdminAuditPdf({ logs, filters: query });
      }
    } catch (err) { setError(err.message || "Unable to export audit records."); }
    finally { setExportingFormat(""); }
  };

  const saveToGoogleDrive = async (format, connected = googleStatus.connected, exportQuery = query) => {
    try {
      setExportingFormat(`drive-${format}`);
      if (!connected) {
        sessionStorage.setItem(PENDING_DRIVE_EXPORT_KEY, JSON.stringify({ format, query: exportQuery }));
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const { authUrl } = await getAdminGoogleConnectUrl(returnTo);
        window.location.assign(authUrl);
        return;
      }
      const { logs } = await getAuditLogExportData(exportQuery);
      let blob;
      let fileName;
      let mimeType;
      if (format === "csv") {
        blob = await exportAuditLogs(exportQuery);
        fileName = `DNHS-SGMS-Audit-Logs-${new Date().toISOString().slice(0, 10)}.csv`;
        mimeType = "text/csv";
      } else {
        const result = format === "xlsx" ? createAdminAuditXlsx({ logs }) : createAdminAuditPdf({ logs, filters: exportQuery });
        ({ blob, fileName } = result);
        mimeType = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
      }
      const result = await saveReportToGoogleDrive({ fileName, mimeType, fileData: await blobToBase64(blob), reportType: `admin_audit_${format}`, convertToGoogleSheet: format === "xlsx" });
      showToast(result.message || "Export saved to Google Drive.", "success");
      if (result.webViewLink) window.open(result.webViewLink, "_blank", "noopener,noreferrer");
    } catch (err) { showToast(err.message || "Unable to save the export to Google Drive.", "error"); }
    finally { setExportingFormat(""); }
  };

  useEffect(() => {
    const callbackUrl = new URL(window.location.href);
    const connected = callbackUrl.searchParams.get("google_connected");
    const callbackError = callbackUrl.searchParams.get("google_error");
    if (!connected && !callbackError) return;

    const pending = sessionStorage.getItem(PENDING_DRIVE_EXPORT_KEY);
    sessionStorage.removeItem(PENDING_DRIVE_EXPORT_KEY);
    callbackUrl.searchParams.delete("google_connected");
    callbackUrl.searchParams.delete("google_error");
    window.history.replaceState({}, "", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);

    if (callbackError) {
      showToast(`Google connection failed: ${callbackError}`, "error");
      return;
    }
    showToast("Google Drive connected successfully.", "success");
    if (pending) {
      try {
        const { format, query: pendingQuery } = JSON.parse(pending);
        if (["pdf", "xlsx", "csv", "sheets"].includes(format)) {
          if (pendingQuery) setQuery(pendingQuery);
          setGoogleStatus((current) => ({ ...current, connected: true }));
          if (format === "sheets") void exportToSheets(true, pendingQuery || INITIAL_FILTERS);
          else void saveToGoogleDrive(format, true, pendingQuery || INITIAL_FILTERS);
        }
      } catch {
        showToast("Google connected, but the pending export could not be resumed. Please save it again.", "error");
      }
    } else {
      getGoogleIntegrationStatus().then(setGoogleStatus).catch(() => {});
    }
  }, []);

  const exportToSheets = async (connected = googleStatus.connected, exportQuery = query) => {
    try {
      setExportingFormat("sheets");
      if (!connected) {
        sessionStorage.setItem(PENDING_DRIVE_EXPORT_KEY, JSON.stringify({ format: "sheets", query: exportQuery }));
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const { authUrl } = await getAdminGoogleConnectUrl(returnTo);
        window.location.assign(authUrl);
        return;
      }
      const { logs } = await getAuditLogExportData(exportQuery);
      const { headers, rows } = adminAuditRowsForSheets(logs);
      const result = await exportReportToGoogleSheets({
        title: `DNHS-SGMS Audit Activity ${new Date().toISOString().slice(0, 10)}`,
        sheetName: "Audit Activity",
        headers,
        rows,
        reportType: "audit_logs",
      });
      showToast(result.message || "Audit activity exported to Google Sheets.", "success");
      window.open(result.spreadsheetUrl, "_blank", "noopener,noreferrer");
    } catch (err) { showToast(err.message || "Unable to export to Google Sheets.", "error"); }
    finally { setExportingFormat(""); }
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
  const visibleRows = useMemo(() => groupFailedLogins(data.logs), [data.logs]);

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedLog?.details || {}, null, 2));
      setCopiedDetails(true);
      window.setTimeout(() => setCopiedDetails(false), 1600);
    } catch {
      showToast("Could not copy change details.", "error");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700"><ShieldCheck size={17} /> Administration</div>
          <h1 className="text-2xl font-bold text-gray-900">Activity monitor</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">Review sign-ins and changes made across grades, classes, accounts, and school settings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadLogs} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
          <ExportDropdown
            label="Download"
            icon={Download}
            open={openExportMenu === "download"}
            onToggle={() => setOpenExportMenu(openExportMenu === "download" ? "" : "download")}
            disabled={!data.logs?.length || Boolean(exportingFormat)}
            loading={exportingFormat}
            options={[
              { label: "PDF", value: "pdf", busy: "Preparing PDF…", onClick: exportLogs },
              { label: "Excel", value: "xlsx", busy: "Preparing Excel…", onClick: exportLogs },
              { label: "CSV", value: "csv", busy: "Preparing CSV…", onClick: exportLogs },
            ]}
          />
          {googleStatus.available && <ExportDropdown
            label="Save to Google Drive"
            icon={Cloud}
            open={openExportMenu === "drive"}
            onToggle={() => setOpenExportMenu(openExportMenu === "drive" ? "" : "drive")}
            disabled={!data.logs?.length || Boolean(exportingFormat)}
            loading={exportingFormat}
            options={[
              { label: "PDF", value: "drive-pdf", busy: "Saving…", onClick: () => saveToGoogleDrive("pdf") },
              { label: "Excel", value: "drive-xlsx", busy: "Saving…", onClick: () => saveToGoogleDrive("xlsx") },
              { label: "CSV", value: "drive-csv", busy: "Saving…", onClick: () => saveToGoogleDrive("csv") },
              { label: "Google Sheets", value: "sheets", busy: "Exporting…", onClick: exportToSheets },
            ]}
          />}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, subtext, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span><Icon size={18} className="text-blue-700" /></div><div className="mt-2 text-2xl font-bold text-slate-900">{Number(value).toLocaleString()}</div><p className="mt-1 text-xs text-slate-500">{subtext}</p></div>)}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-800">Filter this audit table</h2><p className="mt-0.5 text-xs text-slate-500">These filters only narrow the activity records shown below.</p></div><button type="button" onClick={resetFilters} className="rounded-lg px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50">Clear filters</button></div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={Boolean(query.securityOnly)} onClick={() => updateFilter("securityOnly", query.securityOnly ? "" : "true")} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${query.securityOnly ? "border-red-300 bg-red-50 text-red-800 ring-2 ring-red-100" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}><CircleAlert size={13} className="mr-1.5 inline" />Security &amp; Errors</button>
            {query.securityOnly && <span className="text-xs text-slate-500">Showing failed sign-ins, rate limits, and warning events</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">Search this audit table</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700" /><input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} maxLength={100} placeholder="Filter audit records: person, action, record" className="w-full rounded-lg border border-blue-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
            <label><span className="sr-only">Category</span><select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="all">All categories</option>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label><span className="sr-only">Actor role</span><select value={filters.role} onChange={(e) => updateFilter("role", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="all">All roles</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="system">System</option></select></label>
            <label><span className="sr-only">Time period</span><select value={filters.timeframe} onChange={(e) => updateFilter("timeframe", e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="all">Any time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select></label>
          </div>
        </div>

        {error && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3 font-semibold">Action &amp; record</th><th className="px-4 py-3 font-semibold">Who</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">When</th><th className="px-4 py-3 font-semibold">Status</th><th className="sticky right-0 bg-slate-100 px-4 py-3 text-right font-semibold">Details</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Loading activity…</td></tr> : visibleRows.length ? visibleRows.map(({ log, logs: groupedLogs }, rowIndex) => {
                const entityHref = getEntityHref(log);
                const grouped = groupedLogs.length > 1;
                const rowLog = grouped ? { ...log, createdAt: groupedLogs[groupedLogs.length - 1].createdAt } : log;
                return <tr key={`${log._id}-${rowIndex}`} className={`hover:bg-slate-50/80 ${log.status === "failed" ? "border-l-4 border-l-red-300" : log.status === "warning" ? "border-l-4 border-l-amber-300" : ""}`}><td className="max-w-md px-4 py-3"><div className="font-semibold text-slate-800">{grouped ? `User Login (${groupedLogs.length} failed attempts)` : titleCase(log.action)}</div><div className="mt-0.5 whitespace-normal break-words text-slate-600">{grouped ? `Repeated failed sign-in attempts${log.ipAddress ? ` from ${log.ipAddress}` : ""}.` : log.description}</div>{log.target?.name && !grouped && <div className="mt-1 truncate text-xs">{entityHref ? <button type="button" onClick={() => navigate(entityHref)} className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">Record: {log.target.name}</button> : <span className="text-slate-500">Record: {log.target.name}</span>}</div>}</td><td className="px-4 py-3"><ActorCell actor={log.actor} /></td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{CATEGORY_LABELS[log.category] || titleCase(log.category)}</span></td><td className="min-w-[165px] whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(rowLog.createdAt)}</td><td className="px-4 py-3"><StatusBadge log={log} /></td><td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"><button onClick={() => showDetail(log)} className="rounded-md px-2.5 py-1.5 font-semibold text-blue-800 hover:bg-blue-50">Details</button></td></tr>;
              }) : <tr><td colSpan="6" className="px-4 py-14 text-center"><div className="mx-auto flex max-w-sm flex-col items-center text-slate-500"><FileSearch size={30} className="mb-3 text-slate-300" /><div className="font-semibold text-slate-700">No activity found</div><p className="mt-1 text-sm">Try another search or filter. New changes will appear here as they are recorded.</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">Rows per page<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
          <div className="flex items-center gap-3"><span className="text-sm font-medium text-slate-700">Page {page} of {totalPages}</span><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">&lt; Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next &gt;</button></div>
        </footer>
      </section>

      {selectedLog && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setSelectedLog(null)}><aside role="dialog" aria-modal="true" aria-label="Audit record details" onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto scroll-smooth bg-white p-6 pb-8 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-sm font-medium text-blue-700">Audit record</div><h2 className="mt-1 text-xl font-bold text-slate-900">{titleCase(selectedLog.action)}</h2></div><button onClick={() => setSelectedLog(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close details"><X size={19} /></button></div>{detailLoading && <p className="mt-3 text-xs text-slate-400">Loading full record…</p>}<p className="mt-4 text-sm text-slate-600">{selectedLog.description}</p><dl className="mt-6 divide-y divide-slate-100">{[["Actor", selectedLog.actor?.name], ["Email", selectedLog.actor?.email], ["Role", ROLE_LABELS[selectedLog.actor?.role] || titleCase(selectedLog.actor?.role)], ["Date and time", formatDate(selectedLog.createdAt)], ["Category", CATEGORY_LABELS[selectedLog.category] || titleCase(selectedLog.category)], ["Target", selectedLog.target?.name], ["Record type", selectedLog.target?.entityType], ["Record ID", selectedLog.target?.entityId], ["IP address", selectedLog.ipAddress], ["Status", selectedLog.status || "success"]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-3 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="break-words font-medium text-slate-800">{label === "Status" ? <StatusBadge log={selectedLog} /> : value}</dd></div>)}</dl>{selectedLog.details && Object.keys(selectedLog.details).length > 0 && <div className="mt-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">Change details</h3><button type="button" onClick={copyDetails} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50" title="Copy JSON"><Copy size={14} />{copiedDetails ? <><Check size={13} /> Copied</> : "Copy JSON"}</button></div><pre className="mt-2 max-h-[45vh] overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(selectedLog.details, null, 2)}</pre></div>}</aside></div>}
    </div>
  );
}

function ExportDropdown({ label, icon: Icon, open, onToggle, disabled, loading, options }) {
  return <div className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={onToggle} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Icon size={16} />{label}<ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button>
    {open && <div role="menu" className="absolute right-0 z-30 mt-2 min-w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">{options.map((option) => <button key={option.value} type="button" role="menuitem" disabled={Boolean(loading)} onClick={() => { onToggle(); option.onClick(option.value === "xlsx" || option.value === "pdf" || option.value === "csv" ? option.value : undefined); }} className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">{option.label}{loading === option.value && <span className="text-xs text-slate-500">{option.busy}</span>}</button>)}</div>}
  </div>;
}
