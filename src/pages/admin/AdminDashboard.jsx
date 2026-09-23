import { useAuth } from "../../context/AuthContext";

function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800">
        Administrator Dashboard
      </h1>

      <p className="mt-2 text-gray-600">
        Welcome, {user?.name}.
      </p>
    </div>
  );
}

export default AdminDashboard;