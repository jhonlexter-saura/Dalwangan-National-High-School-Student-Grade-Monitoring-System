import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogIn, LayoutDashboard, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function PublicHeader() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { name: "Home", href: "#hero" },
    { name: "Grading System", href: "#grading" },
    { name: "Features", href: "#features" },
    { name: "About", href: "#about" },
    { name: "Contact", href: "#contact" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href) => {
    setMobileMenuOpen(false);
    if (location.pathname !== "/") {
      navigate(`/${href}`);
      return;
    }

    if (href.startsWith("#")) {
      const targetId = href.substring(1);
      const elem = document.getElementById(targetId);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? "border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md"
          : "border-b border-slate-100 bg-white"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          to="/"
          onClick={() => handleNavClick("#hero")}
          className="group flex items-center gap-3 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-2 ring-[#EABE3E] transition group-hover:scale-105">
            <img
              src="/dnhs-logo.svg"
              alt="Dalwangan National High School logo"
              className="h-full w-full rounded-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-lg font-black tracking-tight text-[#000062]">
                DNHS<span className="text-[#EABE3E]">-</span>SGMS
              </span>
              <span className="hidden rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 sm:inline-block">
                DepEd
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Dalwangan National High School
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(link.href);
              }}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#000062]/5 hover:text-[#000062]"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Portal Access CTA */}
        <div className="hidden items-center gap-3 sm:flex">
          {user ? (
            <Link
              to={`/${user.role}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#000062] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#000085] hover:shadow-md"
            >
              <LayoutDashboard size={16} className="text-[#EABE3E]" />
              <span>Go to Dashboard</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#000062] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#000085] hover:shadow-md"
            >
              <LogIn size={16} className="text-[#EABE3E]" />
              <span>Access Portal</span>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 lg:hidden">
          {user ? (
            <Link
              to={`/${user.role}`}
              className="rounded-lg bg-[#000062] p-2 text-white sm:hidden"
              aria-label="Go to Dashboard"
            >
              <LayoutDashboard size={18} />
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-[#000062] p-2 text-white sm:hidden"
              aria-label="Sign In"
            >
              <LogIn size={18} />
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 pt-2 pb-6 shadow-xl lg:hidden">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-base font-medium text-slate-700 hover:bg-[#000062]/5 hover:text-[#000062]"
              >
                <span>{link.name}</span>
                <ChevronRight size={16} className="text-slate-400" />
              </a>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            {user ? (
              <Link
                to={`/${user.role}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#000062] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm"
              >
                <LayoutDashboard size={16} className="text-[#EABE3E]" />
                <span>Go to Dashboard ({user.role})</span>
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#000062] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm"
              >
                <LogIn size={16} className="text-[#EABE3E]" />
                <span>Sign In to DNHS Portal</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default PublicHeader;
