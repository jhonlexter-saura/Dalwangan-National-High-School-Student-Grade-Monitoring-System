import { useState } from "react";
import {
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";

import { createUser } from "../../services/schoolDataService";

export default function AdminStudentAccountCreate() {
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    email: "",
    gradeLevel: "",
    section: "",
    schoolYear: "2026-2027",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (
      !formData.studentId ||
      !formData.name ||
      !formData.email ||
      !formData.gradeLevel ||
      !formData.section ||
      !formData.schoolYear ||
      !formData.password
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);

      await createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: "student",

        studentId: formData.studentId,
        gradeLevel: Number(formData.gradeLevel),
        section: formData.section,
        schoolYear: formData.schoolYear,
      });

      setMessage("Student account created successfully.");

      setFormData({
        studentId: "",
        name: "",
        email: "",
        gradeLevel: "",
        section: "",
        schoolYear: "2026-2027",
        password: "",
      });
    } catch (err) {
      setError(
        err.message || "Failed to create student account."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Create Student Account
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Create a student login account and student profile.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <UserPlus className="h-5 w-5 text-blue-600" />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Student Information
            </h2>

            <p className="text-sm text-gray-500">
              Account and academic information
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Student ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              LRN
            </label>

            <input
              type="text"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="2026-0001"
              className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Student Name
            </label>

            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Juan Dela Cruz"
              className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email Address
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="student@example.com"
              className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Grade + Section */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Grade Level
              </label>

              <select
                name="gradeLevel"
                value={formData.gradeLevel}
                onChange={handleChange}
                className="w-full rounded-lg border bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select grade</option>
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Section
              </label>

              <input
                type="text"
                name="section"
                value={formData.section}
                onChange={handleChange}
                placeholder="Rizal"
                className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* School Year */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              School Year
            </label>

            <select
              name="schoolYear"
              value={formData.schoolYear}
              onChange={handleChange}
              className="w-full rounded-lg border bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="2026-2027">
                2026-2027
              </option>
              <option value="2025-2026">
                2025-2026
              </option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>

            <div className="relative">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                className="w-full rounded-lg border px-3 py-2.5 pr-11 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (prev) => !prev
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              Minimum of 6 characters.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Creating Account..."
              : "Create Student Account"}
          </button>
        </form>
      </div>
    </div>
  );
}