import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuth();

  // User is not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is logged in but doesn't have the required role
  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;