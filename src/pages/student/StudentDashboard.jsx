import { useAuth } from "../../context/AuthContext";

function StudentDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-blue-700 px-6 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          DNHS-SGMS Learner Portal
        </p>
        <h1 className="mt-2 text-2xl font-bold">Student Dashboard</h1>
        <p className="mt-2 text-sm text-blue-100">
          Welcome, {user?.name}.
        </p>
      </section>
      <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-2 w-10 rounded-full bg-yellow-400" />
        <h2 className="mt-4 font-semibold text-blue-700">
          Academic progress
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Use the navigation to view your grades and academic records.
        </p>
      </section>
    </div>
  );
}

export default StudentDashboard;