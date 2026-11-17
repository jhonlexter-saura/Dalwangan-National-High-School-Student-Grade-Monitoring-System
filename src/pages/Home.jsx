import { Link } from "react-router-dom";
import {
  ShieldCheck,
  BookOpen,
  Award,
  ArrowRight,
  Lock,
  Bell,
  FileText,
  Users,
  BarChart3,
  Clock,
  MapPin,
  Mail,
  Phone,
  Sparkles,
  School,
  ChevronRight,
} from "lucide-react";

import PublicHeader from "../components/layout/PublicHeader";
import PublicFooter from "../components/layout/PublicFooter";
import { useAuth } from "../context/AuthContext";

function Home() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased selection:bg-[#EABE3E] selection:text-[#000062]">
      {/* Standard Public Header */}
      <PublicHeader />

      <main className="flex-1">
        {/* ============================================================ */}
        {/* HERO SECTION                                                */}
        {/* ============================================================ */}
        <section
          id="hero"
          className="relative overflow-hidden bg-gradient-to-b from-[#000062] via-[#000052] to-[#000038] py-20 text-white lg:py-28"
        >
          {/* Subtle background glow & pattern */}
          <div className="absolute inset-0 opacity-15">
            <div
              className="h-full w-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url(/background.svg)" }}
            />
          </div>
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#EABE3E]/20 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              {/* Left Column: Headlines & CTAs */}
              <div className="text-center lg:col-span-7 lg:text-left">
                {/* Official DepEd Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-[#EABE3E]/40 bg-[#EABE3E]/10 px-4 py-1.5 text-xs font-semibold text-[#EABE3E] backdrop-blur-sm">
                  <Sparkles size={14} />
                  <span>DepEd K-12 Compliant · Division of Malaybalay City</span>
                </div>

                <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl sm:leading-tight">
                  Dalwangan National High School{" "}
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-[#EABE3E] to-yellow-200">
                    Student Grade Monitoring System
                  </span>
                </h1>

                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  A centralized, secure digital portal designed for learners, educators, and administrators of Dalwangan NHS. Track quarterly grades, compute weighted scores in real-time, and ensure academic integrity.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                  {user ? (
                    <Link
                      to={`/${user.role}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EABE3E] px-7 py-3.5 text-base font-bold text-[#000062] shadow-lg transition hover:bg-amber-300 hover:shadow-xl active:scale-95"
                    >
                      <span>Continue to My Dashboard ({user.role})</span>
                      <ArrowRight size={18} />
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EABE3E] px-8 py-3.5 text-base font-bold text-[#000062] shadow-lg transition hover:bg-amber-300 hover:shadow-xl active:scale-95"
                    >
                      <span>Access Portal / Sign In</span>
                      <ArrowRight size={18} />
                    </Link>
                  )}

                  <a
                    href="#grading"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
                  >
                    <span>DepEd Grading Guide</span>
                    <ChevronRight size={18} />
                  </a>
                </div>

                {/* Quick Trust Highlights */}
                <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-left">
                  <div>
                    <p className="text-xl font-extrabold text-[#EABE3E]">100%</p>
                    <p className="text-xs text-slate-300">DepEd DO 8, s. 2015</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-[#EABE3E]">T1-T3</p>
                    <p className="text-xs text-slate-300">Trimester Tracking</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-[#EABE3E]">MFA & Pin</p>
                    <p className="text-xs text-slate-300">Secure Access</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Visual Card */}
              <div className="lg:col-span-5">
                <div className="relative mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
                  {/* Card Header */}
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white p-1 ring-2 ring-[#EABE3E]">
                      <img
                        src="/dnhs-logo.svg"
                        alt="DNHS Crest"
                        className="h-full w-full rounded-full object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">DNHS-SGMS Portal</h2>
                      <p className="text-xs text-[#EABE3E]">Academic Performance Record</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  </div>

                  {/* Sample Mockup Display */}
                  <div className="mt-5 space-y-3">
                    <div className="rounded-xl bg-white/10 p-3.5">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>DepEd Component Weighting</span>
                        <span className="font-semibold text-[#EABE3E]">Standardized</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="text-[10px] text-slate-400">Written Work</p>
                          <p className="font-bold text-white">20% – 40%</p>
                        </div>
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="text-[10px] text-slate-400">Perf. Tasks</p>
                          <p className="font-bold text-white">40% – 60%</p>
                        </div>
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="text-[10px] text-slate-400">Quarter Exam</p>
                          <p className="font-bold text-white">20%</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/10 p-3.5">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>Quarterly Transmutation</span>
                        <span className="font-semibold text-emerald-300">Automated</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-xs">
                        <span className="text-slate-300">Initial Score: 85.00</span>
                        <span className="text-slate-400">➔</span>
                        <span className="font-bold text-[#EABE3E]">Transmuted: 90 (With Honors)</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                      <p className="text-xs text-slate-300">
                        Unified Institutional Access · Role-Based Access Control (RBAC)
                      </p>
                      <Link
                        to="/login"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#EABE3E] hover:underline"
                      >
                        <span>Sign in with institutional credentials</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* DEPED GRADING SYSTEM & TRANSMUTATION SECTION                 */}
        {/* ============================================================ */}
        <section id="grading" className="bg-white py-20 lg:py-24 border-y border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Department of Education Standard
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#000062] sm:text-4xl">
                DepEd K to 12 Grading System
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                In strict compliance with DepEd Order No. 8, s. 2015, learner performance is evaluated across three core weighted components.
              </p>
            </div>

            {/* Component Cards */}
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                    Component 1
                  </span>
                  <span className="text-sm font-bold text-blue-800">20% – 40%</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Written Work (WW)</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Assesses learners' understanding and retention of concepts. Includes unit tests, written quizzes, essays, and laboratory write-ups.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                    Component 2
                  </span>
                  <span className="text-sm font-bold text-amber-800">40% – 60%</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Performance Tasks (PT)</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Evaluates skills in applying concepts into real-world practice. Includes group presentations, research projects, practical demonstrations, and portfolios.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                    Component 3
                  </span>
                  <span className="text-sm font-bold text-emerald-800">20%</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Quarterly Assessment (QA)</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Measures total learning synthesis at the end of each academic quarter through standardized term examinations.
                </p>
              </div>
            </div>

            {/* Honors & Transmutation Guide */}
            <div className="mt-12 rounded-2xl bg-gradient-to-r from-slate-900 to-[#000062] p-8 text-white shadow-xl">
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-md bg-[#EABE3E]/20 px-3 py-1 text-xs font-semibold text-[#EABE3E]">
                    <Award size={15} />
                    <span>Academic Recognition</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-white">
                    Academic Honors Criteria
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Final quarter averages are transmuted into the official 60–100 DepEd scale. Students maintaining passing marks across all subjects are qualified for honor tiers:
                  </p>

                  <div className="mt-5 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2.5">
                      <span className="font-semibold text-[#EABE3E]">With Highest Honors</span>
                      <span className="font-mono text-sm font-bold">98 – 100</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2.5">
                      <span className="font-semibold text-amber-200">With High Honors</span>
                      <span className="font-mono text-sm font-bold">95 – 97</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2.5">
                      <span className="font-semibold text-yellow-100">With Honors</span>
                      <span className="font-mono text-sm font-bold">90 – 94</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xs">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                    Transmutation Highlights
                  </h4>
                  <p className="mt-2 text-xs text-slate-300">
                    The initial raw score is converted to a Percentage Score (PS), which is then mapped to the official Transmuted Grade:
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-300">
                    <li className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span>Passing Grade Threshold</span>
                      <span className="font-bold text-emerald-400">75 (Initial PS: 60%)</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span>Lowest Transmuted Mark</span>
                      <span className="font-bold text-slate-400">60</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span>Maximum Transmuted Mark</span>
                      <span className="font-bold text-[#EABE3E]">100</span>
                    </li>
                    <li className="flex items-center justify-between pt-1">
                      <span>Automated Computation</span>
                      <span className="font-bold text-blue-300">Instant in DNHS-SGMS</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SYSTEM FEATURES SECTION                                      */}
        {/* ============================================================ */}
        <section id="features" className="py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Key Advantages
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#000062] sm:text-4xl">
                Built for Precision and Ease of Use
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Everything required to eliminate manual recordkeeping errors, foster communication, and protect student privacy.
              </p>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#000062]">
                  <BarChart3 size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">Real-Time Computations</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Scores and transmutation tables update instantaneously as teachers enter marks, eliminating end-of-quarter delays.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <FileText size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">Printable Grade Reports</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Generate professional PDF report slips and class performance summaries ready for Parent-Teacher Conferences.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Lock size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">Multi-Factor & Passkey</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Role-based permissions, 15-minute privileged session limits, Super-User PIN approvals, and biometric Passkey sign-in.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <Bell size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">Academic Notifications</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  In-app notifications alert students and teachers whenever new scores, assignments, or quarter grades are finalized.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">Audit Logs & Integrity</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Every grade adjustment, authentication event, and sensitive change is immutably logged for institutional accountability.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Users size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">Device Friendly Design</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Optimized for mobile smartphones, tablets, and desktops so learners and educators can access records anytime, anywhere.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* ABOUT DALWANGAN NHS SECTION                                  */}
        {/* ============================================================ */}
        <section id="about" className="bg-slate-100/70 py-20 lg:py-24 border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  About Our Institution
                </span>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#000062] sm:text-4xl">
                  Dalwangan National High School
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Located in Dalwangan, Malaybalay City, Bukidnon, Dalwangan National High School is committed to cultivating intellectual competence, moral integrity, and social responsibility in every student.
                </p>

                <div className="mt-6 space-y-4 text-xs text-slate-600">
                  <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-xs">
                    <School className="mt-0.5 shrink-0 text-[#000062]" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-900">DepEd Core Values</h4>
                      <p className="mt-1 text-slate-500">
                        Maka-Diyos, Makatao, Makakalikasan, at Makabansa.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-xs">
                    <BookOpen className="mt-0.5 shrink-0 text-[#000062]" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-900">Commitment to Digital Modernization</h4>
                      <p className="mt-1 text-slate-500">
                        DNHS-SGMS represents the school’s dedication to integrating technology that promotes transparency, minimizes paperwork, and enhances academic outcomes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Institution Seal Card */}
              <div className="flex justify-center lg:col-span-6">
                <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-50 p-3 shadow-inner ring-4 ring-[#EABE3E]/80">
                    <img
                      src="/dnhs-logo.svg"
                      alt="DNHS Official Seal"
                      className="h-full w-full rounded-full object-contain"
                    />
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-[#000062]">
                    Dalwangan National High School
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Division of Malaybalay City · Region X
                  </p>

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <div className="rounded-xl bg-slate-50 p-4 text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Official Academic Motto
                      </p>
                      <p className="mt-1 text-xs italic text-slate-700">
                        "Empowering Learners, Inspiring Excellence, Shaping the Future."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* CALL TO ACTION BANNER                                        */}
        {/* ============================================================ */}
        <section id="cta" className="bg-[#000062] py-16 text-white text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Ready to Access Your Academic Portal?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Sign in with your assigned school credentials to view quarterly grades, encode student activity scores, or administer academic calendars.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              {user ? (
                <Link
                  to={`/${user.role}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EABE3E] px-8 py-3.5 text-base font-bold text-[#000062] shadow-lg transition hover:bg-amber-300"
                >
                  <span>Continue to Dashboard ({user.role})</span>
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EABE3E] px-8 py-3.5 text-base font-bold text-[#000062] shadow-lg transition hover:bg-amber-300"
                >
                  <span>Sign In to DNHS Portal</span>
                  <ArrowRight size={18} />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* CONTACT & LOCATION SECTION                                   */}
        {/* ============================================================ */}
        <section id="contact" className="py-20 lg:py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                School Assistance
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#000062] sm:text-4xl">
                Contact & School Inquiries
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                For account assistance, enrollment verification, or technical support, visit the school administration office or get in touch.
              </p>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-[#000062]">
                  <MapPin size={24} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">Campus Address</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Dalwangan, Malaybalay City, Bukidnon 8700, Philippines
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Clock size={24} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">Office Hours</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Monday to Friday<br />7:30 AM – 5:00 PM
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Mail size={24} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">Support Email</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  info@dnhs-sgms.edu.ph<br />support@dnhs-sgms.edu.ph
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
                  <Phone size={24} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">DepEd Division Office</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Division of Malaybalay City<br />(088) 813-3634
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Standard Public Footer */}
      <PublicFooter />
    </div>
  );
}

export default Home;
