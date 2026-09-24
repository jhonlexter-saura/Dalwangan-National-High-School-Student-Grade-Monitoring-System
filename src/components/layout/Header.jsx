import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Menu,
  Bell,
  UserCircle,
  Search,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const roleName = {
    student: "Student",
    teacher: "Teacher",
    admin: "Administrator",
  };

  // Close the profile dropdown when clicking anywhere outside it
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeProfile = () => setProfileOpen(false);

  const handleLogout = () => {
    closeProfile();
    // NOTE: adjust this if useAuth() exposes the sign-out function under a
    // different name (e.g. signOut) than `logout`.
    logout?.();
    navigate("/login");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">

      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-blue-700 hover:bg-blue-50 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="hidden sm:block">
          <h2 className="text-lg font-semibold text-blue-700">
            {roleName[user?.role] || "User"}
          </h2>

          <p className="hidden text-xs text-gray-500 sm:block">
            Welcome back
          </p>
        </div>
      </div>

      {/* Center - Search bar */}
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-700"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search icon - shown only when the bar is collapsed on small screens */}
        <button className="rounded-md p-2 text-blue-700 hover:bg-blue-50 md:hidden">
          <Search size={20} />
        </button>

        <button className="relative rounded-md p-2 text-blue-700 hover:bg-blue-50">
          <Bell size={20} />

          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md p-2 text-blue-700 hover:bg-blue-50"
          >
            <UserCircle size={24} />

            <span className="hidden text-sm font-medium sm:block">
              {user?.name || "User"}
            </span>

            <ChevronDown
              size={16}
              className={`hidden transition-transform sm:block ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              {/* Name / role */}
              <div className="border-b px-4 py-2">
                <p className="truncate text-sm font-medium text-gray-800">
                  {user?.name || "User"}
                </p>

                <p className="truncate text-xs text-gray-500">
                  {roleName[user?.role] || "User"}
                </p>
              </div>

              {/* Profile / Settings */}
              <div className="border-b py-1">
                <Link
                  to={`/${user?.role}/profile`}
                  onClick={closeProfile}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <User size={16} />
                  Profile
                </Link>

                <Link
                  to={`/${user?.role}/settings`}
                  onClick={closeProfile}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Settings size={16} />
                  Settings
                </Link>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;