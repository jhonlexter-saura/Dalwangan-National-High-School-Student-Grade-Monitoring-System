
import { useEffect, useRef, useState } from "react";
import { getPublicIntegrationSettings } from "../../services/schoolDataService";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import ReCAPTCHA from "react-google-recaptcha";
import { Fingerprint } from "lucide-react";

import { useAuth } from "../../context/AuthContext";

function Login() {
  const { user, login, loginWithGoogle, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const captchaRef = useRef(null);
  const passkeySupported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [captchaSiteKey, setCaptchaSiteKey] = useState(import.meta.env.VITE_RECAPTCHA_SITE_KEY || "");

  const [integrations, setIntegrations] = useState({
    googleSignIn: true,
    recaptcha: true,
  });

  useEffect(() => {
    let mounted = true;

    getPublicIntegrationSettings()
      .then((result) => {
        if (mounted && result.settings) {
          setIntegrations({
            googleSignIn: result.settings.googleSignIn !== false,
            recaptcha: result.settings.recaptcha !== false,
          });
          if (result.settings.recaptchaSiteKey) {
            setCaptchaSiteKey(result.settings.recaptchaSiteKey);
          }
        }
      })
      .catch((error) => {
        console.error("Unable to load integration settings:", error);
        // Keep both integrations enabled by default.
        // The backend independently enforces its saved settings.
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (user) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const finishLogin = (result) => {
    if (!result.success) {
      setError(result.message || "Sign-in failed.");
      return;
    }

    navigate(`/${result.user.role}`, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (integrations.recaptcha && !captchaToken) {
      setError("Please complete the reCAPTCHA checkbox.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(
        email.trim(),
        password,
        captchaToken
      );

      finishLogin(result);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
      setCaptchaToken(null);
      captchaRef.current?.reset();
    }
  };

  const handleGoogleSuccess = async (response) => {
    if (!response.credential) {
      setError("Google did not return a valid sign-in credential.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await loginWithGoogle(response.credential);
      finishLogin(result);
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      setError("Enter your administrator email first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      finishLogin(await loginWithPasskey(email.trim()));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-8"
      style={{ backgroundImage: "url(/background.svg)" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-md rounded-xl border-t-4 border-yellow-400 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-700">
            DNHS-SGMS
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Student Grade Monitoring System
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {integrations.recaptcha && (
          <div className="flex justify-center">
            {captchaSiteKey ? (
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={captchaSiteKey}
                onChange={setCaptchaToken}
                onExpired={() => setCaptchaToken(null)}
                onErrored={() => {
                  setCaptchaToken(null);
                  setError(
                    "reCAPTCHA failed to load. Please refresh and try again."
                  );
                }}
              />
            ) : (
              <p className="text-sm text-red-600">
                reCAPTCHA is not configured.
              </p>
            )}
          </div>
        )}

          <button
            type="submit"
            disabled={loading || (integrations.recaptcha && !captchaSiteKey)}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {(integrations.googleSignIn || passkeySupported) && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="flex flex-col items-center gap-3">
            {passkeySupported && <button type="button" onClick={handlePasskeyLogin} disabled={loading || !email.trim()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Fingerprint size={18} />{loading ? "Verifying passkey…" : "Sign in with Passkey"}</button>}
            {integrations.googleSignIn && <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google sign-in was cancelled or failed.")}
                useOneTap={false}
                text="signin_with"
                shape="rectangular"
                width="320"
              />}
          </div>

          {integrations.googleSignIn && <p className="mt-4 text-center text-xs text-gray-500">Google sign-in is available only for existing, active DNHS-SGMS accounts.</p>}
        </>
      )}
      </div>
    </div>
  );
}

export default Login;
