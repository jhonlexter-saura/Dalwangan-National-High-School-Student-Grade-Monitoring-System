function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-4 text-slate-600 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2.5">
          <img
            src="/dnhs-logo.svg"
            alt="DNHS crest"
            className="h-6 w-6 rounded-full object-contain"
          />
          <div className="text-left leading-tight">
            <span className="text-xs font-bold text-[#000062]">
              DNHS-SGMS
            </span>
            <span className="mx-1.5 text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-600">
              Dalwangan National High School
            </span>
          </div>
        </div>

        <div className="pr-20 text-xs text-slate-500 sm:text-right">
          <p>© {currentYear} Dalwangan National High School. All rights reserved.</p>
          <p className="text-[11px] text-slate-400">Department of Education · Division of Malaybalay City</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
