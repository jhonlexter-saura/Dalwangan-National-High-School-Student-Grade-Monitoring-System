import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Unauthorized() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-xl border-t-4 border-red-500 bg-white p-8 text-center shadow-sm">

        <p className="text-sm font-semibold uppercase tracking-wider text-red-500">
          Forbidden
        </p>

        <h1 className="mt-2 text-6xl font-bold text-blue-700">
          403
        </h1>

        <h2 className="mt-4 text-2xl font-semibold text-gray-900">
          Access Denied
        </h2>

        <p className="mt-2 text-gray-500">
          You do not have permission to access this page.
        </p>

        {user && (
          <p className="mt-3 text-sm text-gray-400">
            You are currently signed in as a{" "}
            <span className="font-medium capitalize text-gray-600">
              {user.role}
            </span>
            .
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <Link
            to={user ? `/${user.role}` : "/login"}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Return to Dashboard
          </Link>

          <Link
            to="/logout"
            className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logout
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Unauthorized;