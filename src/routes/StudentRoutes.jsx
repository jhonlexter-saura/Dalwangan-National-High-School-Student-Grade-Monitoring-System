import StudentDashboard from "../pages/student/StudentDashboard";
import StudentProfile from "../pages/student/StudentProfile";

const studentRoutes = [
  {
    path: "/student",
    element: <StudentDashboard />,
  },
  {
    path: "/student/profile",
    element: <StudentProfile />,
  },
];

export { studentRoutes };