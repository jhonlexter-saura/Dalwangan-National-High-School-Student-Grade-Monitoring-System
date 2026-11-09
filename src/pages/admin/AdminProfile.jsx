import { useState, useEffect, useCallback } from "react";
import { UserCircle, Edit2, Save, X, Loader2, Fingerprint, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { startRegistration } from "@simplewebauthn/browser";
import { deleteAdminPasskey, getAdminPasskeys, getPasskeyRegistrationOptions, verifyPasskeyRegistration } from "../../services/schoolDataService";

function AdminProfile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contactNumber: "",
    address: "",
  });
  const [error, setError] = useState("");

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
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const userId = user?._id || user?.id || user?.userId;

    if (!userId) {
      setError("User ID not found in current session. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("dnhs_token");

      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch(`http://localhost:5000/api/v1/users/${userId}`, {
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

      showToast("Profile updated successfully.", "success");
      setIsEditing(false);
    } catch (error) {
      setError(error.message || "Failed to update profile.");
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

      {error && (
        <div className="mt-4 max-w-lg rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
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

      {user?.role === "admin" && <PasskeyManagement />}
    </div>
  );
}

function PasskeyManagement() {
  const { showToast } = useToast();
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removalPassword, setRemovalPassword] = useState("");
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  function closePasskeyDialog() {
    if (busy) return;
    setAdding(false);
    setRemoveTarget(null);
    setRegistrationPassword("");
    setRemovalPassword("");
    setError("");
  }

  const refreshPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminPasskeys();
      setPasskeys(result.passkeys || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load passkeys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshPasskeys(); }, [refreshPasskeys]);

  async function addPasskey(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { options } = await getPasskeyRegistrationOptions(registrationPassword);
      const response = await startRegistration({ optionsJSON: options });
      await verifyPasskeyRegistration({ response, challenge: options.challenge, deviceName: deviceName.trim() });
      setAdding(false);
      setDeviceName("");
      setRegistrationPassword("");
      showToast("Passkey added to your administrator account.", "success");
      await refreshPasskeys();
    } catch (addError) {
      setError(addError.name === "NotAllowedError" ? "Passkey setup was cancelled or timed out." : addError.message || "Unable to add this passkey.");
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(event) {
    event.preventDefault();
    if (!removeTarget) return;
    setBusy(true);
    setError("");
    try {
      await deleteAdminPasskey(removeTarget._id, removalPassword);
      setRemoveTarget(null);
      setRemovalPassword("");
      showToast("Passkey removed.", "success");
      await refreshPasskeys();
    } catch (removeError) {
      setError(removeError.message || "Unable to remove this passkey.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-6 max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Fingerprint size={21} /></span><div><h2 className="font-semibold text-slate-900">Passkey Management</h2><p className="mt-1 text-sm leading-5 text-slate-600">Use a device screen lock, biometric, or security key to sign in without typing your password.</p></div></div>
      <button type="button" onClick={() => { setDeviceName(""); setRegistrationPassword(""); setError(""); setAdding(true); }} disabled={!supported || busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} /> Add a Passkey</button>
    </div>
    {!supported && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This browser does not support passkeys.</p>}
    {error && !adding && !removeTarget && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
      {loading ? <p className="py-5 text-sm text-slate-500">Loading passkeys…</p> : passkeys.length ? passkeys.map((passkey) => <article key={passkey._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><Fingerprint size={18} className="mt-0.5 shrink-0 text-slate-500" /><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-900">{passkey.deviceName}</h3><p className="mt-1 text-xs leading-5 text-slate-500">Added {new Date(passkey.createdAt).toLocaleDateString()} · Last used {passkey.lastUsedAt ? new Date(passkey.lastUsedAt).toLocaleDateString() : "Never"}</p></div></div>
        <button type="button" onClick={() => { setError(""); setRemovalPassword(""); setRemoveTarget(passkey); }} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:self-auto"><Trash2 size={15} /> Remove</button>
      </article>) : <p className="py-5 text-sm text-slate-500">No passkeys have been added to this account.</p>}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">Your password remains available as a fallback. Confirm your password whenever you add or remove a passkey.</p>

    {(adding || removeTarget) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closePasskeyDialog(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="passkey-dialog-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 id="passkey-dialog-title" className="text-lg font-bold text-slate-900">{adding ? "Add a passkey" : "Remove passkey"}</h2><p className="mt-1 text-sm text-slate-600">{adding ? "Confirm your password, then follow your device's security prompt." : `Remove “${removeTarget?.deviceName}” from this account? Password sign-in will remain available.`}</p></div><button type="button" onClick={closePasskeyDialog} disabled={busy} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close dialog"><X size={18} /></button></div>
        <form onSubmit={adding ? addPasskey : removePasskey} className="mt-5 space-y-4">
          {adding && <label className="block text-sm font-medium text-slate-700">Device name<input autoFocus required maxLength={80} value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="e.g. Office laptop" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>}
          <label className="block text-sm font-medium text-slate-700">Current password<input autoFocus={!adding} required type="password" autoComplete="current-password" value={adding ? registrationPassword : removalPassword} onChange={(event) => adding ? setRegistrationPassword(event.target.value) : setRemovalPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={closePasskeyDialog} disabled={busy} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={busy} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${adding ? "bg-blue-700 hover:bg-blue-800" : "bg-red-700 hover:bg-red-800"}`}>{busy && <Loader2 size={15} className="animate-spin" />}{busy ? "Please wait…" : adding ? "Continue" : "Confirm removal"}</button></div>
        </form>
      </section>
    </div>}
  </section>;
}

export default AdminProfile;
