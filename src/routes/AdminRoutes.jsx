import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminClasses from "../pages/admin/AdminClasses";
import AdminClassOverview from "../pages/admin/AdminClassOverview";
import AdminActivities from "../pages/admin/AdminActivities";
import AdminScores from "../pages/admin/AdminScores";
import AdminProfile from "../pages/admin/AdminProfile";
import AdminSettings from "../pages/admin/AdminSettings";

import AdminStudentAccounts from "../pages/admin/AdminStudentAccounts";
import AdminStudentAccountCreate from "../pages/admin/AdminStudentAccountCreate";
import AdminTeacherAccountCreate from "../pages/admin/AdminTeacherAccountCreate";
import AdminTeacherAccounts from "../pages/admin/AdminTeacherAccounts";
import AdminAccountCreate from "../pages/admin/AdminAccountCreate";
import AdminAccounts from "../pages/admin/AdminAccounts";
import AdminUserEdit from "../pages/admin/AdminUserEdit";
import AdminAcademicCalendar from "../pages/admin/AdminAcademicCalendar";
import AdminAllAccounts from "../pages/admin/AdminAllAccounts";
import AdminIntegrations from "../pages/admin/AdminIntegrations";
import AdminMonitor from "../pages/admin/AdminMonitor";
import Notifications from "../pages/Notifications";

const adminRoutes = [
  {
    path: "/admin",
    element: <AdminDashboard />,
  },
  {
    path: "/admin/monitor",
    element: <AdminMonitor />,
  },
  {
    path: "/admin/notifications",
    element: <Notifications />,
  },
  {
    path: "/admin/classes",
    element: <AdminClasses />,
  },
  {
    path: "/admin/classes/:id",
    element: <AdminClassOverview />,
  },
  {
    path: "/admin/activities",
    element: <AdminActivities />,
  },
  {
    path: "/admin/scores",
    element: <AdminScores />,
  },
  {
    path: "/admin/profile",
    element: <AdminProfile />,
  },
  {
    path: "/admin/settings",
    element: <AdminSettings />,
  },
  {
    path: "/admin/academic-calendar",
    element: <AdminAcademicCalendar />,
  },
  {
    path: "/admin/accounts",
    element: <AdminAllAccounts />,
  },
  {
    path: "/admin/accounts/students/create",
    element: <AdminStudentAccountCreate />,
  },
  {
    path: "/admin/accounts/students",
    element: <AdminStudentAccounts />,
  },
  {
    path: "/admin/accounts/teachers",
    element: <AdminTeacherAccounts/>,
  },
  {
    path: "/admin/accounts/teachers/create",
    element: <AdminTeacherAccountCreate />,
  },
  {
    path: "/admin/accounts/admins/create",
    element: <AdminAccountCreate />,
  },
  {
    path: "/admin/accounts/admins",
    element: <AdminAccounts />,
  },
  {
    path: "/admin/accounts/:role/:id/edit",
    element: <AdminUserEdit />,
  },
  {
    path: "/admin/integrations",
    element: <AdminIntegrations />,
  },
];

export {adminRoutes};
