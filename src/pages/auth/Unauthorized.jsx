import { Link } from "react-router-dom";

function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="rounded-xl border-t-4 border-red-500 bg-white p-8 text-center shadow-sm">

        <h1 className="text-6xl font-bold text-blue-700">
          403
        </h1>

        <h2 className="mt-4 text-2xl font-semibold">
          Access Denied
        </h2>

        <p className="mt-2 text-gray-500">
          You don't have permission to access this page.
        </p>

        <Link
          to="/login"
          className="mt-6 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Return to Login
        </Link>

      </div>
    </div>
  );
}

export default Unauthorized;