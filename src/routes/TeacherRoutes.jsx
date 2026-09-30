import TeacherActivities from "../pages/teacher/TeacherActivities";
import TeacherClassDetails from "../pages/teacher/TeacherClassDetails";
import TeacherClasses from "../pages/teacher/TeacherClasses";
import TeacherDashboard from "../pages/teacher/TeacherDashboard";
import TeacherScores from "../pages/teacher/TeacherScores";

const teacherRoutes = [
  {
    path: "/teacher",
    element: <TeacherDashboard />,
  },
  {
    path: "/teacher/classes",
    element: <TeacherClasses />,
  },
  {
    path: "teacher/classes/:classId",
    element: <TeacherClassDetails />,
  },
  {
    path: "teacher/activities",
    element: <TeacherActivities />,
  },
  {
    path: "teacher/scores",
    element: <TeacherScores />,
  }
];

export {teacherRoutes};