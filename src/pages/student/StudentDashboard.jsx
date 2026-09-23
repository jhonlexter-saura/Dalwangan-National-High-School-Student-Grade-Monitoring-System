import { useAuth } from "../../context/AuthContext";

function StudentDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800">
        Student Dashboard
      </h1>

      <p className="mt-2 text-gray-600">
        Welcome, {user?.name}.
      </p>
    </div>
  );
}

export default StudentDashboard;