import StudentDashboard from "../pages/student/StudentDashboard";
import StudentProfile from "../pages/student/StudentProfile";
import StudentGrades from "../pages/student/StudentGrades";

const studentRoutes = [
  {
    path: "/student",
    element: <StudentDashboard />,
  },
  {
    path: "/student/profile",
    element: <StudentProfile />,
  },
  {
    path: "/student/grades",
    element: <StudentGrades />,
  },
];

export { studentRoutes };
