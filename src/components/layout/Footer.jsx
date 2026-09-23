function Footer() {
  return (
    <footer className="border-t bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Terra_Link
          </p>
          <p className="text-xs text-gray-500">
            Dalwangan National High School · Student Grade Monitoring System
          </p>
        </div>

        <div className="text-xs text-gray-500">
          <p>© 2026 Terra_Link. All rights reserved.</p>
          <p className="mt-1">
            DNHS-SGMS · Academic Grade Monitoring System
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;