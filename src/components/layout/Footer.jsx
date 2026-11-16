function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-4 py-5 text-slate-600 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-700">Terra_Link</p>
          <p className="mt-1 text-xs text-slate-500">
            Dalwangan National High School · Student Grade Monitoring System
          </p>
        </div>

        <div className="text-xs leading-relaxed text-slate-500 sm:text-right">
          <p>© 2026 Terra_Link. All rights reserved.</p>
          <p>DNHS-SGMS · Academic Grade Monitoring System</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;