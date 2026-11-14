/*
 * Palette pulled from the DNHS logo
 *   navy  #000062 (sidebar surface)  /  #00004a (sidebar footer, used here)
 *   gold  #EABE3E
 */

function Footer() {
  return (
    <footer className="relative bg-[#00004a] px-4 py-5 text-white sm:px-6 lg:px-8">
      {/* Gold rule, same treatment as the sidebar brand block */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#EABE3E] via-[#EABE3E]/40 to-transparent" />

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[#EABE3E]">Terra_Link</p>
          <p className="mt-1 text-xs text-white/60">
            Dalwangan National High School · Student Grade Monitoring System
          </p>
        </div>

        <div className="text-xs leading-relaxed text-white/50 sm:text-right">
          <p>© 2026 Terra_Link. All rights reserved.</p>
          <p>DNHS-SGMS · Academic Grade Monitoring System</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;