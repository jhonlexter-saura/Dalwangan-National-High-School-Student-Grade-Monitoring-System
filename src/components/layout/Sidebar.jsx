import {
  LayoutDashboard,
  School,
  ClipboardList,
  ChartNoAxesColumnIncreasing,
  GraduationCap,
  UserPlus,
  UserCog,
  ShieldPlus,
  Settings,
  X,
  CalendarDays,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Put the uploaded logo here: src/assets/dnhs-logo.svg
import dnhsLogo from "../../../public/dnhs-logo.svg";

/*
 * Palette pulled from the DNHS logo
 *   navy  #000062  -> sidebar surface
 *   gold  #EABE3E  -> accent (active bar, icons, rules)
 */

// Philippine school year starts in June
function getSchoolYear() {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `S.Y. ${start}–${start + 1}`;
}

const ROLE_LABEL = {
  admin: "Administrator",
  teacher: "Teacher",
  student: "Student",
};

function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();

  const role = user?.role;
  const displayName = user?.name ?? user?.username ?? user?.email ?? "User";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#00001f]/60 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col
          transform bg-[#000062] text-white
          transition-transform duration-200
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ==================== BRAND ==================== */}
        <div className="relative flex h-20 shrink-0 items-center gap-3 px-5">
          {/* Logo sits on a white disc so the navy seal stays readable */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white p-0.5 ring-2 ring-[#EABE3E]">
            <img
              src={dnhsLogo}
              alt="DNHS logo"
              className="h-full w-full rounded-full object-contain"
            />
          </div>

          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-lg font-bold tracking-tight text-white">
              DNHS-SGMS
            </h1>
            <p className="truncate text-xs text-white/60">
              Grade Monitoring System
            </p>
          </div>

          {/* Close button - mobile */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>

          {/* Gold rule under the brand */}
          <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-[#EABE3E] via-[#EABE3E]/40 to-transparent" />
        </div>

        {/* ==================== NAVIGATION ==================== */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {/* MAIN */}
          <SectionLabel>Main</SectionLabel>

          <div className="space-y-1">
            {/* Dashboard - All roles */}
            <NavItem
              to={`/${role}`}
              end
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              onClick={onClose}
            />

            {/* ADMIN + TEACHER */}
            {(role === "admin" || role === "teacher") && (
              <>
                <NavItem
                  to={`/${role}/classes`}
                  icon={<School size={20} />}
                  label="Classes"
                  onClick={onClose}
                />

                <NavItem
                  to={`/${role}/activities`}
                  icon={<ClipboardList size={20} />}
                  label="Activities"
                  onClick={onClose}
                />

                <NavItem
                  to={`/${role}/scores`}
                  icon={<ChartNoAxesColumnIncreasing size={20} />}
                  label="Scores"
                  onClick={onClose}
                />
              </>
            )}

            {/* STUDENT */}
            {role === "student" && (
              <NavItem
                to="/student/grades"
                icon={<GraduationCap size={20} />}
                label="Grades"
                onClick={onClose}
              />
            )}
          </div>

          {/* ACCOUNT MANAGEMENT */}
          {role === "admin" && (
            <>
              <SectionLabel className="mt-8">Account Management</SectionLabel>

              <div className="space-y-1">
                <NavItem
                  to="/admin/academic-calendar"
                  icon={<CalendarDays size={20} />}
                  label="School Year Calendar"
                  onClick={onClose}
                />

                <NavItem
                  to="/admin/accounts/students"
                  icon={<UserPlus size={20} />}
                  label="Student Accounts"
                  onClick={onClose}
                />

                <NavItem
                  to="/admin/accounts/teachers"
                  icon={<UserCog size={20} />}
                  label="Teacher Accounts"
                  onClick={onClose}
                />

                <NavItem
                  to="/admin/accounts/admins"
                  icon={<ShieldPlus size={20} />}
                  label="Admin Accounts"
                  onClick={onClose}
                />
              </div>
            </>
          )}

          {/* SYSTEM */}
          <SectionLabel className="mt-8">System</SectionLabel>

          <div className="space-y-1">
            <NavItem
              to={`/${role}/settings`}
              icon={<Settings size={20} />}
              label="Settings"
              onClick={onClose}
            />
          </div>
        </nav>
      </aside>
    </>
  );
}

/*
 * Small section heading
 */
function SectionLabel({ children, className = "" }) {
  return (
    <p
      className={`mb-2 flex items-center gap-2 px-3 text-xs font-medium text-white/50 ${className}`}
    >
      <span className="h-px w-3 bg-[#EABE3E]/70" />
      {children}
    </p>
  );
}

/*
 * Reusable navigation item
 */
function NavItem({ to, icon, label, onClick, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `
        group relative flex w-full items-center gap-3
        rounded-lg px-3 py-2.5
        text-sm transition-colors
        ${
          isActive
            ? "bg-white/10 font-medium text-white"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }
        `
      }
    >
      {({ isActive }) => (
        <>
          {/* Gold active indicator */}
          <span
            className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#EABE3E] transition-opacity ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          />

          <span
            className={`transition-colors ${
              isActive
                ? "text-[#EABE3E]"
                : "text-white/60 group-hover:text-[#EABE3E]"
            }`}
          >
            {icon}
          </span>

          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default Sidebar;