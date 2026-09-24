import { UserCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function AdminProfile() {
  const { user } = useAuth();

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Profile
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Your account information.
        </p>
      </div>

      <div className="mt-6 max-w-lg rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserCircle size={40} />
          </div>

          <div>
            <p className="text-lg font-semibold text-gray-800">
              {user?.name || "Administrator"}
            </p>

            <p className="text-sm text-gray-500">
              {user?.email || "—"}
            </p>
          </div>
        </div>

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
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium capitalize text-gray-800">{user?.role || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default AdminProfile;