import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
  createAcademicPeriod,
  deleteAcademicPeriod,
  getAcademicPeriods,
  updateAcademicPeriod,
} from "../../services/schoolDataService";

const emptyForm = {
  schoolYear: "",
  status: "upcoming",
};

const inputClassName =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getCurrentSchoolYear() {
  const year = new Date().getFullYear();
  return `${year}-${year + 1}`;
}

function getSchoolYearRecord(periods, schoolYear) {
  return periods
    .filter((period) => period.schoolYear === schoolYear)
    .sort((a, b) => Number(a.trimester) - Number(b.trimester))[0];
}

function schoolYearDates(schoolYear) {
  const match = schoolYear.match(/^(\d{4})-(\d{4})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
  return {
    startDate: new Date(`${match[1]}-06-01T00:00:00.000Z`),
    endDate: new Date(`${match[2]}-05-31T23:59:59.999Z`),
  };
}

export default function AdminAcademicCalendar() {
  const { showToast } = useToast();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [addedSchoolYears, setAddedSchoolYears] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchoolYear, setNewSchoolYear] = useState("");
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState(() => ({
    ...emptyForm,
    schoolYear: getCurrentSchoolYear(),
  }));
  const schoolYears = useMemo(
    () => [...new Set(periods.map((period) => period.schoolYear))].sort().reverse(),
    [periods]
  );
  const schoolYearOptions = useMemo(() => {
    return [...new Set([...schoolYears, ...addedSchoolYears, getCurrentSchoolYear()])].sort().reverse();
  }, [schoolYears, addedSchoolYears]);
  const groupedPeriods = useMemo(
    () =>
      periods.reduce((groups, period) => {
        groups[period.schoolYear] ||= [];
        groups[period.schoolYear].push(period);
        return groups;
      }, {}),
    [periods]
  );

  useEffect(() => {
    let mounted = true;
    getAcademicPeriods()
      .then((data) => {
        if (mounted) {
          setPeriods(data);
          const currentYearRecord = getSchoolYearRecord(
            data,
            getCurrentSchoolYear()
          );
          if (currentYearRecord) {
            setEditingId(currentYearRecord._id);
            setFormData({
              schoolYear: currentYearRecord.schoolYear,
              status: currentYearRecord.status,
            });
          }
        }
      })
      .catch((loadError) => {
        console.error("Failed to load the school-year calendar:", loadError);
        if (mounted) {
          setError(loadError.message || "Failed to load the school-year calendar.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadPeriods = async () => {
    try {
      setError("");
      setPeriods(await getAcademicPeriods());
    } catch (loadError) {
      console.error("Failed to refresh the school-year calendar:", loadError);
      setError(loadError.message || "Failed to refresh the calendar.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId("");
    setFormData({ ...emptyForm, schoolYear: getCurrentSchoolYear() });
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "schoolYear") {
      const yearRecord = getSchoolYearRecord(periods, value);
      setEditingId(yearRecord?._id || "");
      setFormData({
        schoolYear: value,
        status: yearRecord?.status || "upcoming",
      });
      return;
    }
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleEdit = (period) => {
    setError("");
    setEditingId(period._id);
    setFormData({
      schoolYear: period.schoolYear,
      status: period.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!formData.schoolYear.trim()) {
      setError("School year is required.");
      return;
    }
    const yearDates = schoolYearDates(formData.schoolYear.trim());
    if (!yearDates) {
      setError("Enter a school year in YYYY-YYYY format, such as 2026-2027.");
      return;
    }

    const existingRecord =
      periods.find((period) => period._id === editingId) ||
      getSchoolYearRecord(periods, formData.schoolYear);
    const data = {
      schoolYear: formData.schoolYear.trim(),
      name: existingRecord?.name || `School Year ${formData.schoolYear.trim()}`,
      trimester: existingRecord?.trimester || 1,
      startDate: existingRecord?.startDate || yearDates.startDate,
      endDate: existingRecord?.endDate || yearDates.endDate,
      status: formData.status,
    };
    try {
      setSaving(true);
      if (existingRecord) {
        await updateAcademicPeriod(existingRecord._id, data);
        showToast("School year updated successfully.", "success");
      } else {
        await createAcademicPeriod(data);
        showToast("School year added to the calendar.", "success");
      }
      resetForm();
      await loadPeriods();
    } catch (saveError) {
      console.error("Failed to save school year:", saveError);
      setError(saveError.message || "Failed to save the school year.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSchoolYear = (event) => {
    event.preventDefault();
    const schoolYear = newSchoolYear.trim();
    if (!schoolYearDates(schoolYear)) {
      setModalError("Enter consecutive years in YYYY-YYYY format, such as 2027-2028.");
      return;
    }
    if (schoolYearOptions.includes(schoolYear)) {
      setModalError("That school year is already on the list.");
      return;
    }

    setAddedSchoolYears((current) => [...new Set([...current, schoolYear])]);
    setEditingId("");
    setFormData({ schoolYear, status: "upcoming" });
    setError("");
    setModalError("");
    setNewSchoolYear("");
    setShowAddModal(false);
  };

  const handleDelete = async (period) => {
    if (!window.confirm(`Delete the calendar entry for ${period.schoolYear}?`)) return;
    try {
      setError("");
      await deleteAcademicPeriod(period._id);
      if (editingId === period._id) resetForm();
      showToast("School year deleted.", "success");
      await loadPeriods();
    } catch (deleteError) {
      console.error("Failed to delete school year:", deleteError);
      setError(deleteError.message || "Failed to delete the school year.");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">School Year Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add school years and manage their status.
        </p>
      </header>

      <section className="max-w-3xl rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            {editingId ? <Pencil size={20} /> : <CalendarDays size={20} />}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">
              {editingId ? "Edit school year" : "Set up a school year"}
            </h2>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="School year">
              <select
                className={inputClassName}
                name="schoolYear"
                value={formData.schoolYear}
                onChange={handleChange}
                required
              >
                {schoolYearOptions.map((schoolYear) => (
                  <option key={schoolYear} value={schoolYear}>
                    {schoolYear}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => {
                setModalError("");
                setNewSchoolYear("");
                setShowAddModal(true);
              }}
              disabled={saving}
              aria-label="Add a new school year"
              title="Add a new school year"
              className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus size={20} />
            </button>
            <Field label="Status">
              <select className={inputClassName} name="status" value={formData.status} onChange={handleChange}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            Use + to enter a school year, then save it.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {editingId ? <Save size={17} /> : <Plus size={17} />}
              {saving ? "Saving..." : editingId ? "Save changes" : "Add school year"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <X size={17} /> Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {showAddModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAddModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-school-year-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="add-school-year-title" className="text-lg font-semibold text-gray-900">
              Add a school year
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter the school year range, for example 2027-2028.
            </p>
            <form onSubmit={handleAddSchoolYear} className="mt-5 space-y-4">
              <Field label="School year">
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}-[0-9]{4}"
                  placeholder="2027-2028"
                  value={newSchoolYear}
                  onChange={(event) => {
                    setNewSchoolYear(event.target.value);
                    setModalError("");
                  }}
                  className={inputClassName}
                  required
                />
              </Field>
              {modalError && (
                <p role="alert" className="text-sm text-red-700">{modalError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus size={17} /> Add year
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Calendar school years</h2>
          <p className="text-sm text-gray-500">School years already used by activities cannot be removed.</p>
        </div>
        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">Loading calendar...</div>
        ) : Object.keys(groupedPeriods).length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">No school years have been set up yet.</div>
        ) : (
          Object.keys(groupedPeriods).sort().reverse().map((schoolYear) => (
            <div key={schoolYear} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <h3 className="border-b bg-gray-50 px-5 py-4 font-semibold text-gray-900">School Year {schoolYear}</h3>
              <div className="divide-y">
                {groupedPeriods[schoolYear].slice().sort((a, b) => a.trimester - b.trimester).map((period) => (
                  <div key={period._id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-gray-900">School Year {period.schoolYear}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${period.status === "active" ? "bg-green-100 text-green-700" : period.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}>
                          {period.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Academic year</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(period)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <Pencil size={15} /> Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(period)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
