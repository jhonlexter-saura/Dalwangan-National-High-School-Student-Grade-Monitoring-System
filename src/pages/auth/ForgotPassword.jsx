import { useState } from "react";
import { Link } from "react-router-dom";

import { forgotPassword } from "../../services/schoolDataService";

function ForgotPassword() {
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);

      const result = await forgotPassword({ email });

      setMessage(result.message);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: "url(/background.svg)" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-md rounded-xl border-t-4 border-yellow-400 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-700">
            DNHS-SGMS
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Reset your password
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {message ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>

            <p className="text-sm text-gray-500">
              The link expires in 15 minutes. Check your spam folder if
              you don't see the email.
            </p>

            <Link
              to="/login"
              className="block w-full rounded-md bg-blue-600 px-4 py-2.5 text-center font-medium text-white transition hover:bg-blue-700"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <p className="text-sm text-gray-500">
              Enter the email on your account and we'll send you a link
              to choose a new password.
            </p>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                minLength={5}
                maxLength={100}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending link..." : "Send reset link"}
            </button>

            <p className="text-center text-sm">
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;