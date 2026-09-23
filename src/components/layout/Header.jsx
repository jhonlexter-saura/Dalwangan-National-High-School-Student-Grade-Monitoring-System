import {
  Menu,
  Bell,
  UserCircle,
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

        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {roleName[user?.role] || "User"}
          </h2>

          <p className="hidden text-xs text-gray-500 sm:block">
            Welcome back
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
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