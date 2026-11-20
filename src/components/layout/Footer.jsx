function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#EABE3E]/50 bg-white px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-1 text-center sm:flex-row sm:text-left">
        <p>
          © {currentYear}{" "}
          <span className="font-semibold text-[#000062]">DNHS-SGMS</span>
          <span className="mx-1.5 text-slate-300">·</span>
          Dalwangan National High School
        </p>
        <p className="text-slate-400">
          Department of Education · Division of Malaybalay City
        </p>
      </div>
    </footer>
  );
}

export default Footer;