import { useState } from "react";

function AdminSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Settings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage your account preferences.
        </p>
      </div>

      <div className="mt-6 max-w-lg space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-800">
              Email notifications
            </p>

            <p className="text-xs text-gray-500">
              Get notified about new activities and scores.
            </p>
          </div>

          <button
            onClick={() => setEmailNotifications((prev) => !prev)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              emailNotifications ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                emailNotifications ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-800">
            Change password
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Update the password used to sign in to your account.
          </p>

          <button className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Change password
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminSettings;