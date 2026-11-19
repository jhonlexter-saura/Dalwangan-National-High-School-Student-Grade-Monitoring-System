
import { useEffect, useState } from "react";
import { getPublicIntegrationSettings } from "../../services/schoolDataService";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "../../context/AuthContext";

let recaptchaScriptPromise;

function getRecaptchaToken(siteKey) {
  if (!recaptchaScriptPromise && !window.grecaptcha?.execute) {
    recaptchaScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.grecaptcha);
      script.onerror = () => {
        recaptchaScriptPromise = null;
        reject(new Error("Unable to verify reCAPTCHA. Please try again."));
      };
      document.head.appendChild(script);
    });
  }

  const grecaptchaReady = window.grecaptcha?.execute
    ? Promise.resolve(window.grecaptcha)
    : recaptchaScriptPromise;

  return grecaptchaReady
    .then((grecaptcha) => new Promise((resolve) => grecaptcha.ready(resolve)))
    .then(() => window.grecaptcha.execute(siteKey, { action: "login" }))
    .catch(() => {
      throw new Error("Unable to verify reCAPTCHA. Please try again.");
    });
}

function formatWaitDuration(seconds) {
  const totalSeconds = Math.max(1, Math.ceil(Number(seconds) || 1));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes && remainingSeconds) return `${minutes} minute${minutes === 1 ? "" : "s"} and ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
  if (minutes) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
}

function Login() {
  const { user, login, loginWithGoogle, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const passkeySupported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const waitMessage = result.status === 429 && result.retryAfterSeconds
        ? ` Please wait ${formatWaitDuration(result.retryAfterSeconds)} before trying again.`
        : "";
      setError(`${result.message || "Sign-in failed."}${waitMessage}`);
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

    setLoading(true);

    try {
      const captchaToken = integrations.recaptcha
        ? await getRecaptchaToken(captchaSiteKey)
        : null;
      const result = await login(email.trim(), password, captchaToken);

      finishLogin(result);
    } catch (error) {
      setError(error.message === "Unable to verify reCAPTCHA. Please try again."
        ? error.message
        : "Unable to connect to the server.");
    } finally {
      setLoading(false);
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
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat p-4"
      style={{ backgroundImage: "url(/background.svg)" }}
    >
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]" />

      <div className="relative z-10 my-8 w-full max-w-md">
        <div className="mb-3 text-left">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white transition drop-shadow-sm"
          >
            ← Return to School Homepage
          </Link>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-2 ring-yellow-400">
            <img src="/dnhs-logo.svg" alt="Dalwangan National High School crest" className="h-full w-full rounded-full object-contain" />
          </div>
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

        {integrations.recaptcha && !captchaSiteKey && (
          <p role="alert" className="mb-4 text-center text-sm text-red-600">
            reCAPTCHA is not configured.
          </p>
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
              minLength={5}
              maxLength={100}
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

            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                minLength={6}
                maxLength={128}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-11 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (integrations.recaptcha && !captchaSiteKey)}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {passkeySupported && (
          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={loading}
              className="text-xs font-medium text-gray-500 transition hover:text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Administrator? Sign in with Passkey
            </button>
          </div>
        )}

        {integrations.googleSignIn && (
          <div className="mt-6 flex flex-col items-center">
            <div className="mb-4 flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-500">OR</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in was cancelled or failed.")}
              useOneTap={false}
              text="signin_with"
              shape="rectangular"
              width="320"
              locale="en"
            />
            <p className="mb-3 text-center text-xs text-gray-500">
              Google sign-in is available only for existing, active DNHS-SGMS accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
);
}

export default Login;
