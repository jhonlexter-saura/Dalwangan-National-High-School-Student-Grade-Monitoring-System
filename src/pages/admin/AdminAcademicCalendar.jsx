import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
  createAcademicPeriod,
  deleteAcademicPeriod,
  getAcademicPeriods,
  updateAcademicPeriod,
} from "../../services/schoolDataService";

const inputClassName =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const emptyForm = { schoolYear: "", trimester: "1", name: "", startDate: "", endDate: "", status: "upcoming" };

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function isValidSchoolYear(value) {
  const match = value.match(/^(\d{4})-(\d{4})$/);
  return match && Number(match[2]) === Number(match[1]) + 1;
}

function termTitle(period) {
  const legacyYearTitle = `School Year ${period.schoolYear}`;
  if (period.name?.trim().toLowerCase() === legacyYearTitle.toLowerCase()) {
    return ["1st Quarter / Trimester 1", "2nd Quarter / Trimester 2", "3rd Quarter / Trimester 3"][period.trimester - 1] || `Term ${period.trimester}`;
  }
  return period.name || `Term ${period.trimester}`;
}

export default function AdminAcademicCalendar() {
  const { showToast } = useToast();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formData, setFormData] = useState(emptyForm);

  const groupedPeriods = useMemo(() => periods.reduce((groups, period) => {
    groups[period.schoolYear] ||= [];
    groups[period.schoolYear].push(period);
    return groups;
  }, {}), [periods]);
  const activePeriod = periods.find((period) => period.status === "active");

  const loadPeriods = async () => {
    try {
      setError("");
      setPeriods(await getAcademicPeriods());
    } catch (loadError) {
      console.error("Failed to load the school-year calendar:", loadError);
      setError(loadError.message || "Failed to load the school-year calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPeriods(); }, []);

  const openCreate = () => {
    const year = new Date().getFullYear();
    setEditingId("");
    setFormData({ ...emptyForm, schoolYear: `${year}-${year + 1}`, name: "1st Quarter / Trimester 1" });
    setModalError("");
    setModalOpen(true);
  };

  const handleEdit = (period) => {
    setEditingId(period._id);
    setFormData({
      schoolYear: period.schoolYear,
      trimester: String(period.trimester),
      name: period.name,
      startDate: new Date(period.startDate).toISOString().slice(0, 10),
      endDate: new Date(period.endDate).toISOString().slice(0, 10),
      status: period.status,
    });
    setModalError("");
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setModalError("");
    if (!isValidSchoolYear(formData.schoolYear.trim())) {
      setModalError("Enter consecutive years in YYYY-YYYY format, such as 2026-2027.");
      return;
    }
    if (formData.endDate <= formData.startDate) {
      setModalError("End Date must be after Start Date.");
      return;
    }
    if (formData.status === "active" && activePeriod && activePeriod._id !== editingId) {
      const confirmed = window.confirm(
        `Setting ${formData.schoolYear} to Active will automatically mark the currently active school year (${activePeriod.schoolYear}) as Completed. Continue?`
      );
      if (!confirmed) return;
    }

    const data = {
      ...formData,
      schoolYear: formData.schoolYear.trim(),
      trimester: Number(formData.trimester),
      startDate: new Date(`${formData.startDate}T00:00:00.000Z`),
      endDate: new Date(`${formData.endDate}T23:59:59.999Z`),
    };
    try {
      setSaving(true);
      if (editingId) {
        await updateAcademicPeriod(editingId, data);
        showToast("School year updated successfully.", "success");
      } else {
        await createAcademicPeriod(data);
        showToast("School year added to the calendar.", "success");
      }
      setModalOpen(false);
      await loadPeriods();
    } catch (saveError) {
      console.error("Failed to save school year:", saveError);
      setModalError(saveError.message || "Failed to save the school year.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (period) => {
    if (!window.confirm(`Delete ${termTitle(period)} from School Year ${period.schoolYear}?`)) return;
    try {
      setError("");
      await deleteAcademicPeriod(period._id);
      showToast("School year deleted.", "success");
      await loadPeriods();
    } catch (deleteError) {
      console.error("Failed to delete school year:", deleteError);
      setError(deleteError.message || "Failed to delete the school year.");
    }
  };

  const isReferenced = (period) => period.hasClasses || period.hasActivities;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Year Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">Manage school years, grading terms, and their activity dates.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Plus size={18} /> Add School Year
        </button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Calendar school years</h2>
          <p className="text-sm text-gray-500">Terms with classes or activities, and the active school year, are protected from deletion.</p>
        </div>
        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">Loading calendar...</div>
        ) : Object.keys(groupedPeriods).length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">No school years have been set up yet.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_140px_190px] gap-4 border-b bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
              <span>Term</span><span>School year</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            {Object.keys(groupedPeriods).sort().reverse().flatMap((schoolYear) => groupedPeriods[schoolYear]
              .slice().sort((a, b) => a.trimester - b.trimester)
              .map((period) => {
                const protectedFromDelete = period.status === "active" || isReferenced(period);
                const tooltip = "Cannot delete an active school year or a year with existing records";
                return (
                  <article key={period._id} className="grid gap-3 border-b px-5 py-4 last:border-b-0 md:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_140px_190px] md:items-center md:gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{termTitle(period)}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><CalendarDays size={14} />{formatDate(period.startDate)} – {formatDate(period.endDate)}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-700 md:text-gray-600">School Year {period.schoolYear}</p>
                    <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${period.status === "active" ? "bg-green-100 text-green-700" : period.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}>{period.status}</span></div>
                    <div className="flex gap-2 md:justify-end">
                      <button type="button" onClick={() => handleEdit(period)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Pencil size={15} /> Edit</button>
                      <span className="group relative" title={protectedFromDelete ? tooltip : undefined}>
                        <button type="button" onClick={() => handleDelete(period)} disabled={protectedFromDelete} aria-label={protectedFromDelete ? tooltip : `Delete ${termTitle(period)}`} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"><Trash2 size={15} /> Delete</button>
                        {protectedFromDelete && <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-64 rounded-md bg-gray-900 px-3 py-2 text-xs font-normal text-white shadow-lg group-hover:block">{tooltip}</span>}
                      </span>
                    </div>
                  </article>
                );
              }))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-gray-900/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="school-year-modal-title" className="my-auto w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="school-year-modal-title" className="text-lg font-semibold text-gray-900">{editingId ? "Edit school year term" : "Add school year"}</h2>
                <p className="mt-1 text-sm text-gray-500">Set the year, grading term, and date range.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X size={19} /></button>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="School year"><input className={inputClassName} value={formData.schoolYear} onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })} placeholder="2026-2027" minLength={9} maxLength={9} pattern="[0-9]{4}-[0-9]{4}" required /></Field>
                <Field label="Status"><select className={inputClassName} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
                <Field label="Term"><select className={inputClassName} value={formData.trimester} onChange={(e) => setFormData({ ...formData, trimester: e.target.value })}><option value="1">Trimester 1</option><option value="2">Trimester 2</option><option value="3">Trimester 3</option></select></Field>
                <Field label="Term title"><input className={inputClassName} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} minLength={2} maxLength={60} placeholder="1st Quarter / Trimester 1" required /></Field>
                <Field label="Start Date"><input type="date" className={inputClassName} value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required /></Field>
                <Field label="End Date"><input type="date" min={formData.startDate || undefined} className={inputClassName} value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required /></Field>
              </div>
              {modalError && <p role="alert" className="text-sm text-red-700">{modalError}</p>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Plus size={17} />{saving ? "Saving..." : editingId ? "Save changes" : "Add school year"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>{children}</label>;
}
