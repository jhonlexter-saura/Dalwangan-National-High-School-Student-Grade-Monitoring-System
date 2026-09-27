import TeacherClasses from "../pages/teacher/TeacherClasses";
import TeacherDashboard from "../pages/teacher/TeacherDashboard";

const teacherRoutes = [
  {
    path: "/teacher",
    element: <TeacherDashboard />,
  },
  {
    path: "/teacher/classes",
    element: <TeacherClasses />,
  },
];

export {teacherRoutes};