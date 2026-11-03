import { useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { createUser } from "../../services/schoolDataService";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = { studentId: "", name: "", email: "", password: "" };

export default function AdminStudentAccountCreate() {
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.studentId.trim() || !formData.name.trim() || !formData.email.trim() || !formData.password) {
      setError("Enter the LRN, student name, email address, and temporary password.");
      return;
    }
    if (formData.password.length < 6) {
      setError("Temporary password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);
      await createUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: "student",
        studentId: formData.studentId.trim(),
      });
      showToast("Student account created. Give the temporary password to the student and ask them to change it after signing in.", "success", 7000);
      setFormData(EMPTY_FORM);
    } catch (err) {
      setError(err.message || "Failed to create student account.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Create Student Account</h1>
        <p className="mt-1 text-sm text-gray-500">Create a student login using the learner’s LRN and contact details.</p>
      </header>

      <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100"><UserPlus className="h-5 w-5 text-blue-700" /></div>
          <div><h2 className="font-semibold text-gray-900">Student Information</h2><p className="text-sm text-gray-500">Fields marked with * are required.</p></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="studentId" className="mb-1 block text-sm font-medium text-gray-700">LRN <span className="text-red-600">*</span></label>
            <input id="studentId" type="text" name="studentId" value={formData.studentId} onChange={handleChange} placeholder="Enter learner reference number" autoComplete="off" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">Student Name <span className="text-red-600">*</span></label>
            <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Juan Dela Cruz" autoComplete="name" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email Address <span className="text-red-600">*</span></label>
            <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="student@example.com" autoComplete="email" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Temporary Password <span className="text-red-600">*</span></label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="Set an initial password" autoComplete="new-password" minLength={6} required className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">This password is only for account setup. The student should change it after signing in.</p>
          </div>

          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Creating account…" : "Create Student Account"}
          </button>
        </form>
      </section>
    </div>
  );
}
