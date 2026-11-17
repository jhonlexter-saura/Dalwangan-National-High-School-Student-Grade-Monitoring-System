import { Link } from "react-router-dom";
import {
  BookOpen,
  LogIn,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Clock,
  ExternalLink,
  ArrowUp,
} from "lucide-react";

function PublicFooter() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-slate-800 bg-[#000030] text-slate-300">
      {/* Main 4-column Grid */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: School Identity & Overview */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-2 ring-[#EABE3E]">
                <img
                  src="/dnhs-logo.svg"
                  alt="Dalwangan National High School crest"
                  className="h-full w-full rounded-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">
                  DNHS<span className="text-[#EABE3E]">-</span>SGMS
                </h3>
                <p className="text-xs font-medium text-[#EABE3E]">Student Grade Monitoring System</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              The official digital academic monitoring portal of Dalwangan National High School. Providing learners, educators, and administrators with transparent, secure, and real-time grade tracking.
            </p>

            <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              <ShieldCheck size={15} className="text-[#EABE3E]" />
              <span>DepEd K-12 Compliant (DO 8, s. 2015)</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">
              Navigation
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li>
                <a href="#hero" className="transition hover:text-[#EABE3E]">Home</a>
              </li>
              <li>
                <a href="#grading" className="transition hover:text-[#EABE3E]">DepEd Grading System</a>
              </li>
              <li>
                <a href="#features" className="transition hover:text-[#EABE3E]">System Features</a>
              </li>
              <li>
                <a href="#about" className="transition hover:text-[#EABE3E]">About Dalwangan NHS</a>
              </li>
              <li>
                <a href="#contact" className="transition hover:text-[#EABE3E]">Contact & Location</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Academic Guidelines & DepEd */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">
              Academic Resources
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li>
                <Link to="/login" className="flex items-center gap-2 transition hover:text-[#EABE3E]">
                  <LogIn size={14} className="text-[#EABE3E]" />
                  <span>Institutional Sign-In</span>
                </Link>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <BookOpen size={14} className="text-[#EABE3E]" />
                <span>DepEd Order No. 8, s. 2015</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <ShieldCheck size={14} className="text-[#EABE3E]" />
                <span>Role-Based Access Control</span>
              </li>
              <li className="pt-2">
                <a
                  href="https://www.deped.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"
                >
                  <span>DepEd Official Portal</span>
                  <ExternalLink size={12} />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: School Information & Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">
              School Information
            </h4>
            <ul className="mt-4 space-y-3 text-xs text-slate-400">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#EABE3E]" />
                <span>Dalwangan, Malaybalay City, Bukidnon 8700, Philippines</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock size={16} className="shrink-0 text-[#EABE3E]" />
                <span>Monday – Friday: 7:30 AM – 5:00 PM</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="shrink-0 text-[#EABE3E]" />
                <span>info@dnhs-sgms.edu.ph</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={16} className="shrink-0 text-[#EABE3E]" />
                <span>DepEd Division: (088) 813-3634</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-footer */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <span>© {currentYear} Dalwangan National High School (DNHS-SGMS). All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">DepEd Region X · Division of Malaybalay City</span>
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-slate-300 transition hover:bg-white/20 hover:text-white"
              aria-label="Back to top"
            >
              <span>Back to Top</span>
              <ArrowUp size={13} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
