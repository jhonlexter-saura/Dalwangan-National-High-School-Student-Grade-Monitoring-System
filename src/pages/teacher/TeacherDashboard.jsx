import { useAuth } from "../../context/AuthContext";

function TeacherDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-blue-700 px-6 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          DNHS-SGMS Faculty Portal
        </p>
        <h1 className="mt-2 text-2xl font-bold">Teacher Dashboard</h1>
        <p className="mt-2 text-sm text-blue-100">
          Welcome, {user?.name}.
        </p>
      </section>
      <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-2 w-10 rounded-full bg-yellow-400" />
        <h2 className="mt-4 font-semibold text-blue-700">
          Teaching workspace
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Use the navigation to manage classes, activities, and scores.
        </p>
      </section>
    </div>
  );
}

export default TeacherDashboard;