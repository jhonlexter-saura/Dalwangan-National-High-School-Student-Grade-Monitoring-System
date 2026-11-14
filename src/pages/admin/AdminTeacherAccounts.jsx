import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Power } from "lucide-react";
import {
  getTeachers,
  updateTeacherAccountStatus,
} from "../../services/schoolDataService";
import { useToast } from "../../context/ToastContext";

export default function AdminTeacherAccounts() {
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTeachers();
      setTeachers(data);
    } catch (err) {
      console.error("Failed to load teachers:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleToggleStatus = async (teacher) => {
    const status = teacher.status === "active" ? "inactive" : "active";
    if (status === "inactive" && !window.confirm(`Deactivate ${teacher.name}'s account?`)) {
      return;
    }

    try {
      setUpdatingId(teacher._id);
      setError("");
      const updatedTeacher = await updateTeacherAccountStatus(teacher._id, status);
      setTeachers((current) =>
        current.map((item) => item._id === updatedTeacher._id ? updatedTeacher : item)
      );
      showToast(`Teacher account ${status === "active" ? "activated" : "deactivated"}.`, "success");
    } catch (statusError) {
      console.error("Failed to update teacher account status:", statusError);
      setError(statusError.message || "Failed to update account status.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Teacher Accounts
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage teacher login accounts.
          </p>
        </div>

        <Link
          to="/admin/accounts/teachers/create"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Teacher Account
        </Link>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading teacher accounts...
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-700">
              No teacher accounts yet.
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Create the first teacher account to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Teacher
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Role
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {teachers.map((teacher) => (
                  <tr key={teacher._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {teacher.name}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {teacher.email}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        Teacher
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          teacher.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {teacher.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <Link
                          to={`/admin/accounts/teachers/${teacher._id}/edit`}
                          className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(teacher)}
                          disabled={updatingId === teacher._id}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                            teacher.status === "active"
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          <Power size={15} />
                          {updatingId === teacher._id
                            ? "Saving..."
                            : teacher.status === "active"
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}