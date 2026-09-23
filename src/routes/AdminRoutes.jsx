import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminClasses from "../pages/admin/AdminClasses";
import AdminActivities from "../pages/admin/AdminActivities";
import AdminScores from "../pages/admin/AdminScores";

const adminRoutes = [
  {
    path: "/admin",
    element: <AdminDashboard />,
  },
  {
    path: "/admin/classes",
    element: <AdminClasses />,
  },
  {
    path: "/admin/activities",
    element: <AdminActivities />,
  },
  {
    path: "/admin/scores",
    element: <AdminScores />,
  },
];

export {adminRoutes};