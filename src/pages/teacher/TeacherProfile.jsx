
import { useEffect, useState } from "react";
import { Save, UserRound, Mail, MapPin, Phone, CalendarDays } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getMyProfile,
  updateMyProfile,
} from "../../services/schoolDataService";

const initialForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  nameExtension: "",
  birthdate: "",
  contactNumber: "",
  address: "",
};


function Field({
  label,
  name,
  placeholder,
  required = false,
  value,
  onChange,
  inputClass,
  type = "text",
  minLength,
  maxLength,
  ...props
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {required && (
        <span className="ml-1 text-red-500">*</span>
      )}

      <input
        type={type}
        className={inputClass}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        {...props}
      />
    </label>
  );
}

function TeacherProfile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState(initialForm);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const profile = await getMyProfile();

        if (cancelled) return;

        setForm({
          firstName: profile.firstName || "",
          middleName: profile.middleName || "",
          lastName: profile.lastName || "",
          nameExtension: profile.nameExtension || "",
          birthdate: profile.birthdate || "",
          contactNumber: profile.contactNumber || "",
          address: profile.address || "",
        });

        setEmail(profile.email || "");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load your profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "contactNumber" ? value.replace(/\D/g, "").slice(0, 11) : value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    if (form.contactNumber && form.contactNumber.trim().length !== 11) {
      setError("Contact number must be exactly 11 digits.");
      return;
    }

    try {
      setSaving(true);

      const updatedProfile = await updateMyProfile({
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        nameExtension: form.nameExtension.trim(),
        birthdate: form.birthdate,
        contactNumber: form.contactNumber.trim(),
        address: form.address.trim(),
      });

      setForm({
        firstName: updatedProfile.firstName || "",
        middleName: updatedProfile.middleName || "",
        lastName: updatedProfile.lastName || "",
        nameExtension: updatedProfile.nameExtension || "",
        birthdate: updatedProfile.birthdate || "",
        contactNumber: updatedProfile.contactNumber || "",
        address: updatedProfile.address || "",
      });

      setEmail(updatedProfile.email || email);

      updateUser?.({
        ...updatedProfile,
        _id: updatedProfile._id || user?._id,
      });

      showToast("Your profile has been saved.", "success");
    } catch (err) {
      setError(err.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";



  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        Loading your profile...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-xl bg-blue-700 px-6 py-6 text-white shadow-sm sm:px-8">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-white/15 p-3">
            <UserRound size={30} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
              Teacher account
            </p>
            <h1 className="mt-1 text-2xl font-bold">My Profile</h1>
            <p className="mt-1 text-sm text-blue-100">
              View and update your personal information.
            </p>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Personal information</h2>
          <p className="mt-1 text-sm text-gray-500">
            Fields marked with * are required.
          </p>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field
            label="First name"
            name="firstName"
            placeholder="Enter first name"
            required
            minLength={2}
            maxLength={50}
            value={form.firstName}
            onChange={handleChange}
            inputClass={inputClass}
          />

          <Field
            label="Middle name"
            name="middleName"
            placeholder="Enter middle name (optional)"
            maxLength={50}
            value={form.middleName}
            onChange={handleChange}
            inputClass={inputClass}
          />

          <Field
            label="Last name"
            name="lastName"
            placeholder="Enter last name"
            required
            minLength={2}
            maxLength={50}
            value={form.lastName}
            onChange={handleChange}
            inputClass={inputClass}
          />

          <label className="block text-sm font-medium text-gray-700">
            Name extension
            <select
              className={inputClass}
              name="nameExtension"
              value={form.nameExtension}
              onChange={handleChange}
            >
              <option value="">None</option>
              <option value="Jr.">Jr.</option>
              <option value="Sr.">Sr.</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
              <option value="V">V</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={15} />
              Birth date
            </span>
            <input
              className={inputClass}
              type="date"
              name="birthdate"
              value={form.birthdate}
              onChange={handleChange}
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <Mail size={15} />
              Email address
            </span>
            <input
              className={`${inputClass} cursor-not-allowed bg-gray-100 text-gray-500`}
              type="email"
              value={email}
              readOnly
              aria-describedby="email-help"
            />
            <span id="email-help" className="mt-1 block text-xs text-gray-500">
              Contact your administrator to change your email address.
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <Phone size={15} />
              Contact number
            </span>
            <input
              className={inputClass}
              type="tel"
              inputMode="numeric"
              name="contactNumber"
              value={form.contactNumber}
              onChange={handleChange}
              minLength={11}
              maxLength={11}
              pattern="[0-9]{11}"
              title="11-digit mobile number"
              placeholder="09123456789 (11 digits)"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} />
              Address
            </span>
            <textarea
              className={inputClass}
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Enter your address"
              maxLength={255}
              rows={3}
            />
          </label>
        </div>

        {error && (
          <div className="px-6 pb-2" role="alert">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TeacherProfile;
