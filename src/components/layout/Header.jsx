import {
  Menu,
  Bell,
  UserCircle,
  Search,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

function Header({ onMenuClick }) {
  const {user} = useAuth();

  const roleName = {
    student: "Student",
    teacher: "Teacher",
    admin: "Administrator",
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">

      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 hover:bg-gray-100 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="hidden sm:block">
          <h2 className="text-lg font-semibold text-gray-800">
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
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search icon - shown only when the bar is collapsed on small screens */}
        <button className="rounded-md p-2 hover:bg-gray-100 md:hidden">
          <Search size={20} />
        </button>

        <button className="relative rounded-md p-2 hover:bg-gray-100">
          <Bell size={20} />

          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <button className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-100">
          <UserCircle size={24} />

          <span className="hidden text-sm font-medium sm:block">
            {user?.name || "User"}
          </span>
        </button>
      </div>
    </header>
  );
}

export default Header;