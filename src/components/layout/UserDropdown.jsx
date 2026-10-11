import { useState } from "react";
import { Link } from "react-router-dom";
import { User, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function UserDropdown() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Dynamic route prefix based on user role (defaulting to student)
  const rolePrefix = user?.role || "student";

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full focus:outline-none"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 font-bold text-white shadow-sm">
          {user?.name?.[0] || "S"}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 z-50">
          {/* Header Section */}
          <div className="bg-[#000052] p-5 text-white">
            <h3 className="text-lg font-bold leading-tight">
              {user?.name || "Saturnino Telamo"}
            </h3>
            <p className="mt-0.5 text-sm text-gray-300 capitalize">
              {user?.role || "Student"}
            </p>
            {/* Gold Accent Bar */}
            <div className="mt-3 h-1 w-10 rounded-full bg-amber-400" />
          </div>

          {/* Menu Links */}
          <div className="py-2">
            <Link
              to={`/${rolePrefix}/profile`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3.5 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <User className="h-5 w-5 text-gray-700" />
              Profile
            </Link>

            <Link
              to={`/${rolePrefix}/settings`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3.5 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Settings className="h-5 w-5 text-gray-700" />
              Settings
            </Link>

            <div className="my-1 border-t border-gray-100" />

            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-3.5 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <LogOut className="h-5 w-5 text-gray-700" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}