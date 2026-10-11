import { useState, useEffect } from "react";
import { User, Mail, Shield, Edit2, Save, X, Loader2, Calendar } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function StudentProfile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    birthdate: "",
    studentId: "",
    gradeLevel: "",
    section: "",
    contactNumber: "",
  });

  // Load existing profile data (S-007)
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        address: user.address || "",
        birthdate: user.birthdate || "",
        studentId: user.studentId || "2026-00123",
        gradeLevel: user.gradeLevel || "Grade 10",
        section: user.section || "Emerald",
        contactNumber: user.contactNumber || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save updated profile (S-006)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Call your backend/auth context update function here
      if (updateUser) {
        await updateUser(formData);
      }

      showToast("Profile updated successfully!", "success");
      setIsEditing(false);
    } catch (err) {
      showToast(err.message || "Failed to update profile", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#000052] p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-400 text-3xl font-bold text-blue-950 border-4 border-white shadow-md">
            {formData.name?.[0] || "S"}
          </div>

          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold">{formData.name}</h1>
            <p className="mt-1 text-blue-200">
              {formData.gradeLevel} - {formData.section} | Student ID: {formData.studentId}
            </p>
            <div className="mt-3 h-1.5 w-16 rounded-full bg-amber-400 mx-auto md:mx-0" />
          </div>

          {/* S-006: Edit Toggle Button */}
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#000052] shadow hover:bg-gray-100 transition"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-2 rounded-xl bg-red-500/80 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Profile Details Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <User className="h-5 w-5 text-blue-700" />
          <h2 className="text-lg font-bold text-gray-800">
            {isEditing ? "Edit Account Information" : "Account Details"}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              name="name"
              disabled={!isEditing}
              value={formData.name}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border px-3.5 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              type="text"
              name="address"
              disabled={!isEditing}
              value={formData.address}
              onChange={handleChange}
              placeholder="e.g. Kalasungay"
              className="mt-1 w-full rounded-lg border px-3.5 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
              required
            />
          </div>

          {/* Birthdate */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Birthdate</label>
            <input
              type="date"
              name="birthdate"
              disabled={!isEditing}
              value={formData.birthdate}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border px-3.5 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
              required
            />
          </div>

          {/* Student ID (Read Only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Student ID</label>
            <input
              type="text"
              disabled
              value={formData.studentId}
              className="mt-1 w-full rounded-lg border bg-gray-100 px-3.5 py-2.5 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Contact Number</label>
            <input
              type="text"
              name="contactNumber"
              disabled={!isEditing}
              value={formData.contactNumber}
              onChange={handleChange}
              placeholder="e.g. 09123456789"
              className="mt-1 w-full rounded-lg border px-3.5 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>

        {/* Save Changes Button (Appears only during Edit mode) */}
        {isEditing && (
          <div className="flex justify-end border-t pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 font-medium text-white shadow hover:bg-blue-800 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}