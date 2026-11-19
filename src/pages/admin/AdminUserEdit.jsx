import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStudent,
  getUser,
  updateStudentProfile,
  updateUserProfile,
} from "../../services/schoolDataService";
import { useToast } from "../../context/ToastContext";

const roleAliases = {
  student: "student",
  students: "student",
  teacher: "teacher",
  teachers: "teacher",
  admin: "admin",
  admins: "admin",
};

const roleLabels = {
  student: "Student",
  teacher: "Teacher",
  admin: "Administrator",
};

const STUDENT_ID_MAX_LENGTH = 12;

const emptyProfile = {
  name: "",
  email: "",
  studentId: "",
  gradeLevel: "",
  section: "",
  schoolYear: "",
};

const inputClassName =
  "w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50";

export default function AdminUserEdit() {
  const { role: roleParam, id } = useParams();
  const role = roleAliases[roleParam];
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!Object.hasOwn(roleLabels, role)) {
        setError("This account type cannot be edited.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const profile =
          role === "student" ? await getStudent(id) : await getUser(id);

        if (role !== "student" && profile.role !== role) {
          throw new Error("The selected account does not match this account type.");
        }

        if (active) {
          setFormData({
            name: profile.name || "",
            email: profile.email || "",
            studentId: profile.studentId || "",
            gradeLevel: profile.gradeLevel ? String(profile.gradeLevel) : "",
            section: profile.section || "",
            schoolYear: profile.schoolYear || "",
          });
          setProfileLoaded(true);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load this profile.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [id, role]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: name === "studentId" ? value.replace(/\D/g, "").slice(0, STUDENT_ID_MAX_LENGTH) : value,
    }));
  };

  const handleCancel = () => {
    navigate(`/admin/accounts/${role === "admin" ? "admins" : `${role}s`}`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    if (role === "student") {
      if (formData.studentId.trim().length !== STUDENT_ID_MAX_LENGTH) {
        setError(`LRN must be exactly ${STUDENT_ID_MAX_LENGTH} digits.`);
        return;
      }
      if (
        !formData.studentId.trim() ||
        !formData.gradeLevel ||
        !formData.section.trim() ||
        !formData.schoolYear.trim()
      ) {
        setError("Please complete all student profile fields.");
        return;
      }

      const gradeLevel = Number(formData.gradeLevel);
      if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
        setError("Grade level must be between 7 and 12.");
        return;
      }
    }

    const update = {
      name: formData.name.trim(),
      email: formData.email.trim(),
    };

    try {
      setSaving(true);

      if (role === "student") {
        await updateStudentProfile(id, {
          ...update,
          studentId: formData.studentId.trim(),
          gradeLevel: Number(formData.gradeLevel),
          section: formData.section.trim(),
          schoolYear: formData.schoolYear.trim(),
        });
      } else {
        await updateUserProfile(id, update);
      }

      showToast(`${roleLabels[role]} profile updated successfully.`, "success");
      navigate(`/admin/accounts/${role === "admin" ? "admins" : `${role}s`}`);
    } catch (saveError) {
      setError(saveError.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        Loading profile...
      </div>
    );
  }

  if (!profileLoaded) {
    return (
      <div className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Edit {roleLabels[role] || "Account"} Profile
        </h1>
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error || "Failed to load this profile."}
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Accounts
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Edit {roleLabels[role] || "Account"} Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Update profile information. Password, account status, and role are managed separately.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label={`${roleLabels[role] || "Account"} Name`}>
            <input
              className={inputClassName}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              minLength={2}
              maxLength={100}
              required
              disabled={saving}
              autoComplete="name"
            />
          </Field>

          <Field label="Email">
            <input
              className={inputClassName}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              minLength={5}
              maxLength={100}
              required
              disabled={saving}
              autoComplete="email"
            />
          </Field>

          {role === "student" && (
            <>
              <Field label="LRN (12 digits)">
                <input
                  className={inputClassName}
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  minLength={STUDENT_ID_MAX_LENGTH}
                  maxLength={STUDENT_ID_MAX_LENGTH}
                  pattern="[0-9]{12}"
                  title="12-digit Learner Reference Number"
                  inputMode="numeric"
                  required
                  disabled={saving}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Grade Level">
                  <select
                    className={`${inputClassName} bg-white`}
                    name="gradeLevel"
                    value={formData.gradeLevel}
                    onChange={handleChange}
                    required
                    disabled={saving}
                  >
                    <option value="">Select grade</option>
                    {[7, 8, 9, 10, 11, 12].map((grade) => (
                      <option key={grade} value={grade}>
                        Grade {grade}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Section">
                  <input
                    className={inputClassName}
                    type="text"
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    minLength={1}
                    maxLength={50}
                    required
                    disabled={saving}
                  />
                </Field>
              </div>

              <Field label="School Year">
                <input
                  className={inputClassName}
                  type="text"
                  name="schoolYear"
                  value={formData.schoolYear}
                  onChange={handleChange}
                  minLength={9}
                  maxLength={9}
                  pattern="[0-9]{4}-[0-9]{4}"
                  required
                  disabled={saving}
                  placeholder="2026-2027"
                />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-3 border-t pt-5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
