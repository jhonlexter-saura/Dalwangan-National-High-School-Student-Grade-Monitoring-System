import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  Menu,
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { getMyNotifications } from "../../services/schoolDataService";

/*
 * Palette pulled from the DNHS logo
 *   navy  #000062
 *   gold  #EABE3E
 *
 * Height is h-20 so it lines up with the sidebar's brand block.
 * If you change one, change the other.
 */

function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);

  const roleName = {
    student: "Student",
    teacher: "Teacher",
    admin: "Administrator",
  };

  const displayName = user?.name || user?.username || "User";

  useEffect(() => {
    let isCurrent = true;
    const refreshNotifications = async () => {
      if (!user) {
        setUnreadCount(0);
        return;
      }
      try {
        const result = await getMyNotifications();
        if (isCurrent) setUnreadCount(result.unreadCount || 0);
      } catch {
        if (isCurrent) setUnreadCount(0);
      }
    };

    const handleNotificationsUpdated = () => refreshNotifications();
    window.addEventListener("dnhs:notifications-updated", handleNotificationsUpdated);
    window.addEventListener("focus", refreshNotifications);
    const refreshTimer = window.setInterval(refreshNotifications, 30000);
    refreshNotifications();

    return () => {
      isCurrent = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshNotifications);
      window.removeEventListener("dnhs:notifications-updated", handleNotificationsUpdated);
    };
  }, [user?._id, location.pathname]);

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
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-[#EABE3E]/60 bg-white px-4 lg:px-8">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[#000062] hover:bg-[#000062]/5 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>

        <div className="hidden leading-tight sm:block">
          <h2 className="text-lg font-bold tracking-tight text-[#000062]">
            {roleName[user?.role] || "User"}
          </h2>

          <p className="text-xs text-gray-500">Welcome back</p>
        </div>
      </div>

      {/* Center - Search bar */}
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#000062]/60"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border border-transparent bg-[#000062]/5 py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#EABE3E] focus:bg-white focus:ring-2 focus:ring-[#EABE3E]/30"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Search icon - shown only when the bar is collapsed on small screens */}
        <button
          className="rounded-lg p-2 text-[#000062] hover:bg-[#000062]/5 md:hidden"
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        <Link
          to={`/${user?.role}/notifications`}
          className="relative rounded-lg p-2 text-[#000062] hover:bg-[#000062]/5"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Divider */}
        <div className="mx-1 hidden h-8 w-px bg-gray-200 sm:block" />

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2.5 rounded-lg p-1.5 pr-2 hover:bg-[#000062]/5"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#000062] text-sm font-bold text-[#EABE3E] ring-2 ring-[#EABE3E]/60">
              {displayName.charAt(0).toUpperCase()}
            </span>

            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[10rem] truncate text-sm font-medium text-[#000062]">
                {displayName}
              </span>
              <span className="block text-xs text-gray-500">
                {roleName[user?.role] || "User"}
              </span>
            </span>

            <ChevronDown
              size={16}
              className={`hidden text-[#000062]/60 transition-transform sm:block ${
                profileOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {/* Name / role */}
              <div className="border-b border-gray-100 bg-[#000062] px-4 py-3">
                <p className="truncate text-sm font-medium text-white">
                  {displayName}
                </p>

                <p className="truncate text-xs text-white/60">
                  {roleName[user?.role] || "User"}
                </p>

                <div className="mt-2 h-0.5 w-8 rounded-full bg-[#EABE3E]" />
              </div>

              {/* Profile / Settings */}
              <div className="border-b border-gray-100 py-1">
                <Link
                  to={`/${user?.role}/profile`}
                  onClick={closeProfile}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#000062]/5 hover:text-[#000062]"
                >
                  <User size={16} />
                  Profile
                </Link>

                <Link
                  to={`/${user?.role}/settings`}
                  onClick={closeProfile}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-[#000062]/5 hover:text-[#000062]"
                >
                  <Settings size={16} />
                  Settings
                </Link>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
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
