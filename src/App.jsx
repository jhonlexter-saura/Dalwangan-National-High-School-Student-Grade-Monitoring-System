import { BrowserRouter, useRoutes } from "react-router-dom";

import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import Login from "./pages/auth/Login";
import Unauthorized from "./pages/auth/Unauthorized";

import { studentRoutes } from "./routes/StudentRoutes";
import { teacherRoutes } from "./routes/TeacherRoutes";
import { adminRoutes } from "./routes/AdminRoutes";

import Logout from "./pages/auth/Logout";

function AppRoutes() {
  const routes = [
    // Public routes
    {
      path: "/login",
      element: <Login />,
    },
    {
      path:"/logout",
      element: <Logout />
    },
    {
      path: "/unauthorized",
      element: <Unauthorized />,
    },

    // Protected application
    {
      element: <Layout />,
      children: [

        // Student
        {
          element: (
            <ProtectedRoute allowedRoles={["student"]} />
          ),
          children: studentRoutes,
        },

        // Teacher
        {
          element: (
            <ProtectedRoute allowedRoles={["teacher"]} />
          ),
          children: teacherRoutes,
        },

        // Administrator
        {
          element: (
            <ProtectedRoute allowedRoles={["admin"]} />
          ),
          children: adminRoutes,
        },

      ],
    },
  ];

  return useRoutes(routes);
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;