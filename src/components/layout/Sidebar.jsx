import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Settings,
  LogOut,
  X,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Sidebar({ isOpen, onClose }) {
  const {user} = useAuth();
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          transform border-r bg-white
          transition-transform duration-200
          lg:static lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div>
            <h1 className="text-lg font-bold">
              DNHS-SGMS
            </h1>

            <p className="text-xs text-gray-500">
              Grade Monitoring System
            </p>
          </div>

          {/* Close button - mobile */}
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-gray-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4">
  <p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-400">
    Main
  </p>

  <div className="space-y-1">
    <NavItem
      to={`/${user?.role}`}
      icon={<LayoutDashboard size={20} />}
      label="Dashboard"
    />

    {user?.role === "admin" && (
      <>
        <NavItem
          to="/admin/classes"
          icon={<Users size={20} />}
          label="Classes"
        />

        <NavItem
          to="/admin/activities"
          icon={<ClipboardList size={20} />}
          label="Activities"
        />

        <NavItem
          to="/admin/scores"
          icon={<BookOpen size={20} />}
          label="Scores"
        />
      </>
    )}

    {user?.role === "teacher" && (
      <>
        <NavItem
          to="/teacher/classes"
          icon={<Users size={20} />}
          label="Classes"
        />

        <NavItem
          to="/teacher/activities"
          icon={<ClipboardList size={20} />}
          label="Activities"
        />

        <NavItem
          to="/teacher/scores"
          icon={<BookOpen size={20} />}
          label="Scores"
        />
      </>
    )}

    {user?.role === "student" && (
      <NavItem
        to="/student/grades"
        icon={<BookOpen size={20} />}
        label="Grades"
      />
    )}
  </div>

  <p className="mb-2 mt-8 px-3 text-xs font-semibold uppercase text-gray-400">
    System
  </p>

  <div className="space-y-1">
    <NavItem
      to="/logout"
      icon={<LogOut size={20} />}
      label="Logout"
    />
  </div>
</nav>
      </aside>
    </>
  );
}

/*
 * Reusable navigation item
 */
function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex w-full items-center gap-3
        rounded-md px-3 py-2
        text-sm transition
        ${
          isActive
            ? "bg-blue-50 font-medium text-blue-600"
            : "text-gray-700 hover:bg-gray-100"
        }
        `
      }
    >
      {icon}

      <span>{label}</span>
    </NavLink>
  );
}

export default Sidebar;