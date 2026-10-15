import { useState, useEffect } from "react";
import { UserCircle, Edit2, Save, X, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function AdminProfile() {
  const { user, updateUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contactNumber: "",
    address: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });

  // Keep form data in sync with current user state
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        contactNumber: user.contactNumber || user.contact || user.phone || "",
        address: user.address || user.location || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        contactNumber: user.contactNumber || user.contact || user.phone || "",
        address: user.address || user.location || "",
      });
    }
    setMessage({ type: "", text: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    const userId = user?._id || user?.id || user?.userId;

    if (!userId) {
      setMessage({
        type: "error",
        text: "User ID not found in current session. Please log in again.",
      });
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("dnhs_token");

      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error (${response.status} ${response.statusText}).`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update profile.");
      }

      // Sync state and localStorage
      const updatedUser = data.user || data;
      if (updateUser) {
        updateUser(updatedUser);
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setIsEditing(false);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update profile.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper values for view mode
  const currentContact = user?.contactNumber || user?.contact || user?.phone || "—";
  const currentAddress = user?.address || user?.location || "—";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Your account information.</p>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Edit2 size={16} />
            Edit Profile
          </button>
        )}
      </div>

      {message.text && (
        <div
          className={`mt-4 max-w-lg rounded-md p-3 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-6 max-w-lg rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserCircle size={40} />
          </div>

          <div>
            <p className="text-lg font-semibold text-gray-800">
              {user?.name || "Administrator"}
            </p>
            <p className="text-sm text-gray-500">{user?.email || "—"}</p>
          </div>
        </div>

        {isEditing ? (
          /* EDIT FORM */
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t pt-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700">
                Contact Number <span className="text-xs text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                id="contactNumber"
                name="contactNumber"
                placeholder="e.g. 09123456789"
                value={formData.contactNumber}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address <span className="text-xs text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                id="address"
                name="address"
                placeholder="e.g. Brgy. Dalwangan, Malaybalay City"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <X size={16} />
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          /* DISPLAY MODE */
          <dl className="mt-6 divide-y border-t">
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-gray-500">Full name</dt>
              <dd className="font-medium text-gray-800">{user?.name || "—"}</dd>
            </div>

            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-800">{user?.email || "—"}</dd>
            </div>

            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-gray-500">Contact Number</dt>
              <dd className="font-medium text-gray-800">{currentContact}</dd>
            </div>

            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-gray-500">Address</dt>
              <dd className="font-medium text-gray-800">{currentAddress}</dd>
            </div>

            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium capitalize text-gray-800">{user?.role || "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

export default AdminProfile;