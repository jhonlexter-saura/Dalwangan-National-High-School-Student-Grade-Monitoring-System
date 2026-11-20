import { useEffect, useState } from "react";
import CodeInput from "../../components/ui/CodeInput";
import {
  Fingerprint,
  Globe,
  ShieldCheck,
  Mail,
  Plug,
  RefreshCw,
  AlertCircle,
  Database,
  KeyRound,
  FileSpreadsheet,
  FileText,
  Cloud,
  ChevronDown,
  ChevronUp,
  Lock,
  LockOpen,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";

import {
  getIntegrationSettings,
  requestIntegrationAccessCode,
  verifyIntegrationAccessCode,
  requestIntegrationChangeApproval,
  verifyIntegrationApproval,
  updateIntegrationSetting,
  updateCustomIntegrationConfig,
  exportAuditLogs,
  getAuditLogExportData,
  getGoogleConnectUrl,
  getGoogleIntegrationStatus,
  disconnectGoogle,
  testRecaptchaCredentials,
  testMailerCredentials,
} from "../../services/schoolDataService";
import { downloadAdminAuditPdf, downloadAdminAuditXlsx } from "../../utils/adminAuditExports";

const INTEGRATIONS = [
  {
    key: "googleSignIn",
    title: "Google Sign-In",
    description:
      "Allow users to sign in with Google when the email matches an existing active DNHS-SGMS account.",
    detail: "Uses the Google OAuth Client ID configured on the server.",
    Icon: Globe,
    customGroup: "google",
  },
  {
    key: "recaptcha",
    title: "reCAPTCHA v3",
    description:
      "Verify password sign-ins invisibly with a risk score.",
    detail: "Uses the reCAPTCHA v3 site key and secret configured in the server environment.",
    Icon: ShieldCheck,
    customGroup: "recaptcha",
  },
  {
    key: "emailMailer",
    title: "Email Mailer",
    description:
      "Send password reset links to students and teachers by email.",
    detail: "Uses the Gmail mailer credentials configured on the server.",
    Icon: Mail,
    customGroup: "email",
  },
  {
    key: "adminPasskeys",
    title: "Admin Passkeys",
    description:
      "Let active administrator accounts sign in with a device passkey or security key.",
    detail: "Uses SimpleWebAuthn. Add or remove your devices from your administrator profile.",
    Icon: Fingerprint,
    available: true,
    managementPath: "/admin/profile",
  },
];

function AdminIntegrations() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    googleSignIn: true,
    recaptcha: true,
    emailMailer: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [sessionExpiresAt, setSessionExpiresAt] = useState(() => {
    const token = sessionStorage.getItem("dnhs_integration_access");
    const stored = sessionStorage.getItem("dnhs_integration_access_expires");
    if (!token || !stored) {
      sessionStorage.removeItem("dnhs_integration_access");
      sessionStorage.removeItem("dnhs_integration_access_expires");
      return null;
    }
    const timestamp = Number(stored);
    if (isNaN(timestamp) || Date.now() >= timestamp) {
      sessionStorage.removeItem("dnhs_integration_access");
      sessionStorage.removeItem("dnhs_integration_access_expires");
      return null;
    }
    return timestamp;
  });
  const [accessToken, setAccessToken] = useState(() => {
    const stored = sessionStorage.getItem("dnhs_integration_access_expires");
    if (!stored || Date.now() >= Number(stored)) {
      sessionStorage.removeItem("dnhs_integration_access");
      sessionStorage.removeItem("dnhs_integration_access_expires");
      return "";
    }
    return sessionStorage.getItem("dnhs_integration_access") || "";
  });
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [accessChallengeId, setAccessChallengeId] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [approval, setApproval] = useState(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalRequesting, setApprovalRequesting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [googleStatus, setGoogleStatus] = useState({ available: false, connected: false, email: "" });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [customWarning, setCustomWarning] = useState("");
  const [customConfig, setCustomConfig] = useState({});
  const [draft, setDraft] = useState({
    tokenSecret: "",
    emailUser: "",
    emailPassword: "",
    googleClientId: "",
    googleClientSecret: "",
    googleTokenKey: "",
    recaptchaSiteKey: "",
    recaptchaSecretKey: "",
  });
  const [expandedConfig, setExpandedConfig] = useState({});
  const [unlockedConfigs, setUnlockedConfigs] = useState({});
  const [recaptchaTesting, setRecaptchaTesting] = useState(false);
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const [verifiedPair, setVerifiedPair] = useState({ siteKey: "", secretKey: "" });
  const [recaptchaTestState, setRecaptchaTestState] = useState({
    status: "untested",
    message: "Credentials have not yet been tested.",
  });
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmailPair, setVerifiedEmailPair] = useState({ emailUser: "", emailPassword: "" });
  const [emailTestState, setEmailTestState] = useState({
    status: "untested",
    message: "Credentials have not yet been tested.",
  });

  useEffect(() => {
    if (!accessToken || !sessionExpiresAt) {
      setSecondsRemaining(null);
      return undefined;
    }

    function checkSession() {
      const remaining = Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        sessionStorage.removeItem("dnhs_integration_access");
        sessionStorage.removeItem("dnhs_integration_access_expires");
        setAccessToken("");
        setSessionExpiresAt(null);
        setUnlockedConfigs({});
        setExpandedConfig({});
        setSecurityError("Your 15-minute integration session has expired. Verify with the super user again to continue.");
      }
    }

    checkSession();
    const interval = setInterval(checkSession, 1000);
    return () => clearInterval(interval);
  }, [accessToken, sessionExpiresAt]);

  async function handleConfigureClick(group, integrationKey) {
    if (savingKey || approvalRequesting || Boolean(approval)) return;

    // If already expanded, clicking collapses the panel without re-authenticating
    if (expandedConfig[integrationKey]) {
      setExpandedConfig((prev) => ({ ...prev, [integrationKey]: false }));
      return;
    }

    // If already unlocked in this session, simply expand it
    if (unlockedConfigs[group]) {
      setExpandedConfig((prev) => ({ ...prev, [integrationKey]: true }));
      return;
    }

    // Require Super-User PIN approval the moment Configure is clicked
    await requestApprovedChange("configure-integration", { target: group }, async ({ approvalId, pin }) => {
      const result = await verifyIntegrationApproval(approvalId, pin, "configure-integration", { target: group });
      setUnlockedConfigs((prev) => ({ ...prev, [group]: result.configToken }));
      setExpandedConfig((prev) => ({ ...prev, [integrationKey]: true }));
      showToast(result.message || "Custom configuration unlocked.", "success");
    });
  }

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const result = await getIntegrationSettings();
      setSettings(result.settings);
      setCustomConfig(result.customConfig || {});
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        sessionStorage.removeItem("dnhs_integration_access");
        sessionStorage.removeItem("dnhs_integration_access_expires");
        setAccessToken("");
        setSessionExpiresAt(null);
        setUnlockedConfigs({});
        setExpandedConfig({});
        setSecurityError(err.message || "Integration access expired. Verify with the super user again.");
      } else {
        setError(err.message || "Unable to load integration settings.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshGoogleStatus() {
    try { setGoogleStatus(await getGoogleIntegrationStatus()); }
    catch (err) {
      if (err.status === 401 || err.status === 403) {
        sessionStorage.removeItem("dnhs_integration_access");
        sessionStorage.removeItem("dnhs_integration_access_expires");
        setAccessToken("");
        setSessionExpiresAt(null);
        setUnlockedConfigs({});
        setExpandedConfig({});
        setSecurityError(err.message || "Integration access expired. Verify with the super user again.");
      }
      setGoogleStatus({ available: false, connected: false, email: "" });
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return undefined;
    }
    void Promise.resolve().then(() => Promise.all([loadSettings(), refreshGoogleStatus()]));
    const refreshOnReturn = () => { void refreshGoogleStatus(); };
    window.addEventListener("pageshow", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);

    const callbackUrl = new URL(window.location.href);
    const connected = callbackUrl.searchParams.get("google_connected");
    const callbackError = callbackUrl.searchParams.get("google_error");
    if (connected === "true") {
      showToast("Google Drive connected successfully.", "success");
    } else if (callbackError) {
      showToast(`Google connection failed: ${callbackError}`, "error");
    }
    if (connected || callbackError) {
      callbackUrl.searchParams.delete("google_connected");
      callbackUrl.searchParams.delete("google_error");
      window.history.replaceState({}, "", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
    }

    return () => {
      window.removeEventListener("pageshow", refreshOnReturn);
      window.removeEventListener("focus", refreshOnReturn);
    };
  }, [showToast, accessToken]);

  async function handleAccessSubmit(event) {
    event.preventDefault();
    setAccessBusy(true);
    setSecurityError("");
    try {
      if (!accessChallengeId) {
        const result = await requestIntegrationAccessCode(accessEmail);
        setAccessChallengeId(result.challengeId);
        setSecurityError("");
        showToast(result.message, "success");
      } else {
        const result = await verifyIntegrationAccessCode(accessChallengeId, accessCode);
        const expiresTimestamp = result.expiresAt
          ? new Date(result.expiresAt).getTime()
          : Date.now() + 15 * 60 * 1000;
        sessionStorage.setItem("dnhs_integration_access", result.accessToken);
        sessionStorage.setItem("dnhs_integration_access_expires", String(expiresTimestamp));
        setAccessToken(result.accessToken);
        setSessionExpiresAt(expiresTimestamp);
        setAccessChallengeId("");
        setAccessCode("");
      }
    } catch (err) {
      setSecurityError(err.message || "Unable to verify super-user access.");
    } finally {
      setAccessBusy(false);
    }
  }

  async function requestApprovedChange(action, payload, onApprove) {
    setApprovalRequesting(true);
    setSecurityError("");
    try {
      const result = await requestIntegrationChangeApproval(action, payload);
      setApproval({
        approvalId: result.approvalId,
        action,
        pin: "",
        onApprove,
        error: "",
      });
      showToast(result.message, "success", 6500);
    } catch (err) {
      setError(err.message || "Unable to request super-user approval.");
    } finally {
      setApprovalRequesting(false);
    }
  }

  async function handleApprovalSubmit(event) {
    event.preventDefault();
    if (!approval || approvalBusy) return;
    setApprovalBusy(true);
    setApproval((current) => ({ ...current, error: "" }));
    try {
      await approval.onApprove({ approvalId: approval.approvalId, pin: approval.pin });
      setApproval(null);
    } catch (err) {
      setApproval((current) => ({ ...current, error: err.message || "The super-user PIN could not be verified." }));
    } finally {
      setApprovalBusy(false);
    }
  }

  async function handleGoogleConnect() {
    await requestApprovedChange("google-connect", {}, async (approved) => {
      setGoogleBusy(true);
      try {
        const { authUrl } = await getGoogleConnectUrl("/admin/integrations", approved);
        window.location.assign(authUrl);
      } catch (err) {
        showToast(err.message || "Unable to start Google Drive connection.", "error");
        throw err;
      } finally { setGoogleBusy(false); }
    });
  }

  async function handleGoogleDisconnect() {
    await requestApprovedChange("google-disconnect", {}, async (approved) => {
      setGoogleBusy(true);
      try {
        const result = await disconnectGoogle(approved);
        setGoogleStatus((current) => ({ ...current, connected: false, email: "", connectedAt: null, lastUsedAt: null }));
        showToast(result.message || "Google account disconnected.", "success");
      } catch (err) {
        showToast(err.message || "Unable to disconnect Google account.", "error");
        throw err;
      } finally { setGoogleBusy(false); }
    });
  }

  async function handleToggle(key) {
    if (savingKey || key === "emailMailer") return;

    const nextValue = !settings[key];
    await requestApprovedChange("toggle-setting", { key, value: nextValue }, async (approved) => {
      setSavingKey(key);
      setError("");
      try {
        const result = await updateIntegrationSetting(key, nextValue, approved);
        setSettings(result.settings);
        showToast(result.message || "Integration setting saved.", "success");
      } catch (err) {
        setError(err.message || "Unable to save the setting.");
        throw err;
      } finally {
        setSavingKey("");
      }
    });
  }

  async function saveCustom(group, values) {
    if (savingKey) return;

    const draftFieldByEnvKey = {
      CUSTOM_AUTH_TOKEN_SECRET: "tokenSecret",
      CUSTOM_EMAIL_USER: "emailUser",
      CUSTOM_EMAIL_APP_PASSWORD: "emailPassword",
      CUSTOM_GOOGLE_CLIENT_ID: "googleClientId",
      CUSTOM_GOOGLE_CLIENT_SECRET: "googleClientSecret",
      CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY: "googleTokenKey",
      CUSTOM_VITE_GOOGLE_CLIENT_ID: "googleClientId",
      CUSTOM_RECAPTCHA_SECRET_KEY: "recaptchaSecretKey",
      CUSTOM_VITE_RECAPTCHA_SITE_KEY: "recaptchaSiteKey",
    };

    // If unlocked via configure-button MFA, save directly using configToken
    const configToken = unlockedConfigs[group];
    if (configToken) {
      setSavingKey(group);
      setError("");
      setCustomWarning("");
      try {
        const result = await updateCustomIntegrationConfig(values, { configToken });
        setCustomConfig(result.customConfig || {});
        setCustomWarning("");
        showToast(result.message || "Custom settings verified and saved.", "success", 6500);
        setDraft((current) => ({ ...current, ...Object.fromEntries(Object.keys(values).map((key) => [draftFieldByEnvKey[key], ""])) }));
        if (group === "recaptcha") {
          setRecaptchaVerified(false);
          setVerifiedPair({ siteKey: "", secretKey: "" });
          setRecaptchaTestState({
            status: "untested",
            message: "Credentials have not yet been tested.",
          });
        }
        if (group === "email") {
          setEmailVerified(false);
          setVerifiedEmailPair({ emailUser: "", emailPassword: "" });
          setEmailTestState({
            status: "untested",
            message: "Credentials have not yet been tested.",
          });
        }
      } catch (err) {
        const msg = err.message || "Unable to save custom settings.";
        setError(msg);
        setCustomWarning(msg);
        if (err.status === 403) {
          // Re-lock if the config session expired
          setUnlockedConfigs((prev) => ({ ...prev, [group]: "" }));
        }
      } finally {
        setSavingKey("");
      }
      return;
    }

    // Fallback: request one-time approval if saved without pre-unlocking
    await requestApprovedChange("custom-config", values, async (approved) => {
      setSavingKey(group);
      setError("");
      setCustomWarning("");
      try {
        const result = await updateCustomIntegrationConfig(values, approved);
        setCustomConfig(result.customConfig || {});
        setCustomWarning("");
        showToast(result.message || "Custom settings verified and saved.", "success", 6500);
        setDraft((current) => ({ ...current, ...Object.fromEntries(Object.keys(values).map((key) => [draftFieldByEnvKey[key], ""])) }));
        if (group === "recaptcha") {
          setRecaptchaVerified(false);
          setVerifiedPair({ siteKey: "", secretKey: "" });
          setRecaptchaTestState({
            status: "untested",
            message: "Credentials have not yet been tested.",
          });
        }
        if (group === "email") {
          setEmailVerified(false);
          setVerifiedEmailPair({ emailUser: "", emailPassword: "" });
          setEmailTestState({
            status: "untested",
            message: "Credentials have not yet been tested.",
          });
        }
      } catch (err) {
        const msg = err.message || "Unable to save custom settings.";
        setError(msg);
        setCustomWarning(msg);
        throw err;
      } finally {
        setSavingKey("");
      }
    });
  }

  async function handleExport(format) {
    setExportingFormat(format);
    try {
      if (format === "csv") {
        const blob = await exportAuditLogs({});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `DNHS-SGMS-Audit-Logs-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const { logs } = await getAuditLogExportData({});
        if (format === "xlsx") downloadAdminAuditXlsx({ logs });
        else downloadAdminAuditPdf({ logs, filters: {} });
      }
      showToast(`${format === "xlsx" ? "Excel spreadsheet" : format.toUpperCase()} export downloaded.`, "success");
    } catch (exportError) {
      showToast(exportError.message || `Unable to export ${format.toUpperCase()} data.`, "error");
    } finally {
      setExportingFormat("");
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
  const cardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
  const actionLocked = Boolean(savingKey) || approvalRequesting || Boolean(approval);

  /* ── Custom config panel renderers, keyed by integration customGroup ── */

  function renderGoogleConfig() {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700"><Globe size={20} /></span>
            <div>
              <h4 className="font-semibold text-slate-900">Google OAuth credentials</h4>
              <p className="mt-1 text-sm text-slate-600">Set the OAuth client used for sign-in and Drive exports.</p>
            </div>
          </div>
          <ConfigBadge active={Boolean(customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_GOOGLE_CLIENT_SECRET?.configured)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Google OAuth Client ID<input type="text" autoComplete="off" minLength={10} maxLength={255} value={draft.googleClientId} onChange={(e) => setDraft({ ...draft, googleClientId: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured ? "Saved · enter a replacement" : "…apps.googleusercontent.com"} className={inputClass} /></label>
          <label className="block text-sm font-medium text-slate-700">Google OAuth Client Secret<input type="password" autoComplete="new-password" minLength={10} maxLength={255} value={draft.googleClientSecret} onChange={(e) => setDraft({ ...draft, googleClientSecret: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_CLIENT_SECRET?.configured ? "Saved securely · enter a replacement" : "Server-side client secret"} className={inputClass} /></label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Google token encryption key<input type="password" autoComplete="new-password" minLength={32} maxLength={255} value={draft.googleTokenKey} onChange={(e) => setDraft({ ...draft, googleTokenKey: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY?.configured ? "Saved securely · enter a replacement" : "At least 32 characters · keep this key stable"} className={inputClass} /></label>
        </div>
        <p className="text-xs leading-5 text-slate-500">The client ID is public. The client secret and encryption key stay on the server and are never shown after saving. Keep the encryption key stable so saved Google connections remain usable. Configure the OAuth redirect URL as your server's /api/v1/integrations/google/callback address.</p>
        <ConfigActions busy={savingKey === "google"} locked={actionLocked} configured={Boolean(customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_GOOGLE_CLIENT_SECRET?.configured || customConfig.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY?.configured)} onSave={() => saveCustom("google", { CUSTOM_GOOGLE_CLIENT_ID: draft.googleClientId, CUSTOM_VITE_GOOGLE_CLIENT_ID: draft.googleClientId, CUSTOM_GOOGLE_CLIENT_SECRET: draft.googleClientSecret, CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY: draft.googleTokenKey })} onReset={() => saveCustom("google", { CUSTOM_GOOGLE_CLIENT_ID: "", CUSTOM_VITE_GOOGLE_CLIENT_ID: "", CUSTOM_GOOGLE_CLIENT_SECRET: "", CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY: "" })} disabled={!draft.googleClientId.trim() || !draft.googleClientSecret.trim() || draft.googleTokenKey.trim().length < 32} />
      </div>
    );
  }

  async function handleTestRecaptcha() {
    const siteKey = draft.recaptchaSiteKey.trim().replace(/^["']|["']$/g, "");
    const secretKey = draft.recaptchaSecretKey.trim().replace(/^["']|["']$/g, "");

    // Layer 1 — Input validation
    if (!siteKey || !secretKey) {
      setRecaptchaTestState({
        status: "failed",
        message: "Please enter both the Site Key and Secret Key before testing.",
      });
      showToast("Both Site Key and Secret Key are required.", "error");
      return;
    }

    const keyFormatRegex = /^[A-Za-z0-9_-]{25,100}$/;
    if (!keyFormatRegex.test(siteKey)) {
      setRecaptchaTestState({
        status: "failed",
        message: "Invalid Site Key format. Expected 30–60 letters, numbers, hyphens, or underscores.",
      });
      showToast("Invalid Site Key format.", "error");
      return;
    }
    if (!keyFormatRegex.test(secretKey)) {
      setRecaptchaTestState({
        status: "failed",
        message: "Invalid Secret Key format. Expected 30–60 letters, numbers, hyphens, or underscores.",
      });
      showToast("Invalid Secret Key format.", "error");
      return;
    }

    setRecaptchaTesting(true);
    setRecaptchaTestState({
      status: "testing",
      message: "Rendering reCAPTCHA challenge and generating token...",
    });

    try {
      // Layer 2 & 3 — Load candidate site key into DOM and execute challenge
      const existingScripts = document.querySelectorAll('script[src*="recaptcha"]');
      existingScripts.forEach((s) => s.remove());
      const existingBadges = document.querySelectorAll(".grecaptcha-badge");
      existingBadges.forEach((b) => b.remove());
      delete window.grecaptcha;

      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Unable to load Google reCAPTCHA. Check your network or site key."));
        document.head.appendChild(script);
      });

      if (!window.grecaptcha?.ready) {
        throw new Error("Google reCAPTCHA failed to initialize in the browser.");
      }

      await new Promise((resolve) => window.grecaptcha.ready(resolve));

      setRecaptchaTestState({
        status: "testing",
        message: "Completing provider challenge with candidate site key...",
      });

      const responseToken = await window.grecaptcha.execute(siteKey, {
        action: "test_credentials",
      });

      if (!responseToken || typeof responseToken !== "string") {
        throw new Error(
          "reCAPTCHA did not return a valid challenge token. Verify that this Site Key is active and allows this domain in Google Cloud Console."
        );
      }

      setRecaptchaTestState({
        status: "testing",
        message: "Submitting response token and secret key to backend for paired verification...",
      });

      // Layer 3 & 4 — Submit to backend validation endpoint
      const result = await testRecaptchaCredentials({
        siteKey,
        secretKey,
        responseToken,
      });

      if (result.success && result.verified) {
        setRecaptchaVerified(true);
        setVerifiedPair({ siteKey, secretKey });
        setRecaptchaTestState({
          status: "verified",
          message: `Credentials successfully verified with Google${typeof result.score === "number" ? ` (Score: ${result.score})` : ""}. You can now save.`,
        });
        showToast("reCAPTCHA credentials verified successfully!", "success");
      } else {
        setRecaptchaVerified(false);
        setRecaptchaTestState({
          status: "failed",
          message:
            result.error ||
            "Verification failed. The site key and secret key may not be a valid pair.",
        });
        showToast(result.error || "reCAPTCHA verification failed.", "error");
      }
    } catch (err) {
      setRecaptchaVerified(false);
      setRecaptchaTestState({
        status: "failed",
        message: err.message || "reCAPTCHA verification failed.",
      });
      showToast(err.message || "reCAPTCHA verification failed.", "error");
    } finally {
      setRecaptchaTesting(false);
      // Clean up test badge so it does not permanently hover over the page
      const badges = document.querySelectorAll(".grecaptcha-badge");
      badges.forEach((b) => b.remove());
    }
  }

  function renderRecaptchaConfig() {
    const hasKeysEntered = Boolean(draft.recaptchaSiteKey.trim() && draft.recaptchaSecretKey.trim());
    const isPairVerified =
      recaptchaVerified &&
      verifiedPair.siteKey === draft.recaptchaSiteKey.trim().replace(/^["']|["']$/g, "") &&
      verifiedPair.secretKey === draft.recaptchaSecretKey.trim().replace(/^["']|["']$/g, "");

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h4 className="font-semibold text-slate-900">reCAPTCHA Configuration</h4>
              <p className="mt-1 text-sm text-slate-600">
                Set and verify the public v3 site key and its private server secret.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-slate-500">Integration status</span>
            {isPairVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Verified
              </span>
            ) : hasKeysEntered ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Not verified
              </span>
            ) : customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Active configuration
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Not configured
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Site Key
            <input
              type="text"
              autoComplete="off"
              minLength={10}
              maxLength={255}
              value={draft.recaptchaSiteKey}
              onChange={(e) => {
                const val = e.target.value;
                setDraft({ ...draft, recaptchaSiteKey: val });
                if (recaptchaVerified) setRecaptchaVerified(false);
                if (recaptchaTestState.status !== "untested") {
                  setRecaptchaTestState({
                    status: "untested",
                    message: "Credentials have not yet been tested.",
                  });
                }
              }}
              placeholder={
                customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured
                  ? "Saved · enter a replacement"
                  : "Enter reCAPTCHA site key"
              }
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Secret Key
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={255}
              value={draft.recaptchaSecretKey}
              onChange={(e) => {
                const val = e.target.value;
                setDraft({ ...draft, recaptchaSecretKey: val });
                if (recaptchaVerified) setRecaptchaVerified(false);
                if (recaptchaTestState.status !== "untested") {
                  setRecaptchaTestState({
                    status: "untested",
                    message: "Credentials have not yet been tested.",
                  });
                }
              }}
              placeholder={
                customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured
                  ? "Saved securely · enter a replacement"
                  : "Enter reCAPTCHA secret key"
              }
              className={inputClass}
            />
          </label>
        </div>

        {/* Credential verification */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/75 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Credential verification
            </span>
            {isPairVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <ShieldCheck size={14} /> Provider verified
              </span>
            )}
          </div>

          <p
            className={`text-xs ${
              isPairVerified
                ? "font-medium text-emerald-700"
                : recaptchaTestState.status === "failed"
                  ? "font-medium text-red-600"
                  : recaptchaTestState.status === "testing"
                    ? "font-medium text-blue-700"
                    : "text-slate-500"
            }`}
          >
            {isPairVerified
              ? recaptchaTestState.message || "Credentials successfully verified with Google."
              : hasKeysEntered && recaptchaTestState.status === "untested"
                ? "Credentials have not yet been tested."
                : recaptchaTestState.message || "Credentials have not yet been tested."}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!hasKeysEntered || recaptchaTesting || actionLocked}
              onClick={handleTestRecaptcha}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recaptchaTesting && <RefreshCw size={13} className="animate-spin text-blue-600" />}
              {recaptchaTesting ? "Testing Credentials…" : "Test Credentials"}
            </button>
            <span className="text-[11px] text-slate-500">
              Renders and verifies the candidate key pair with Google reCAPTCHA.
            </span>
          </div>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          The secret key must remain on the backend. It is never returned in API responses, logs, or stored in frontend state beyond testing. Only tested and verified configurations can be saved.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionLocked || !isPairVerified || savingKey === "recaptcha"}
            onClick={() =>
              saveCustom("recaptcha", {
                CUSTOM_RECAPTCHA_SECRET_KEY: draft.recaptchaSecretKey,
                CUSTOM_VITE_RECAPTCHA_SITE_KEY: draft.recaptchaSiteKey,
              })
            }
            className="rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingKey === "recaptcha" ? "Saving…" : "Save Configuration"}
          </button>
          <button
            type="button"
            disabled={
              actionLocked ||
              (!customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured &&
                !customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured)
            }
            onClick={() =>
              saveCustom("recaptcha", {
                CUSTOM_RECAPTCHA_SECRET_KEY: "",
                CUSTOM_VITE_RECAPTCHA_SITE_KEY: "",
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use existing default
          </button>
        </div>
      </div>
    );
  }

  async function handleTestEmail() {
    const emailUser = draft.emailUser.trim().toLowerCase();
    const emailPassword = draft.emailPassword.trim().replace(/\s+/g, "");

    // Layer 1 — Input validation
    if (!emailUser || !emailPassword) {
      setEmailTestState({
        status: "failed",
        message: "Please enter both the Gmail account and Gmail App Password before testing.",
      });
      showToast("Both Gmail account and App Password are required.", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailUser)) {
      setEmailTestState({
        status: "failed",
        message: "Invalid email address format.",
      });
      showToast("Enter a valid email address.", "error");
      return;
    }

    if (!/^[a-zA-Z0-9]{16}$/.test(emailPassword)) {
      setEmailTestState({
        status: "failed",
        message: "Invalid Gmail app password format. Expected a 16-character Google App Password.",
      });
      showToast("Google App Passwords must be 16 characters (letters or numbers).", "error");
      return;
    }

    setEmailTesting(true);
    setEmailTestState({
      status: "testing",
      message: "Verifying SMTP credentials with Gmail (smtp.gmail.com)...",
    });

    try {
      // Layer 2 & 3 — Backend provider verification via nodemailer verify()
      const res = await testMailerCredentials({
        emailUser,
        emailPassword,
      });

      if (res && res.verified) {
        setEmailVerified(true);
        setVerifiedEmailPair({ emailUser, emailPassword });
        setEmailTestState({
          status: "verified",
          message: res.message || "Credentials successfully verified with Gmail. You can now save.",
        });
        showToast("Gmail mailer credentials verified successfully!", "success");
      } else {
        setEmailVerified(false);
        setEmailTestState({
          status: "failed",
          message:
            res?.error ||
            "SMTP verification failed. Verify your email and 16-character App Password.",
        });
        showToast(res?.error || "SMTP verification failed.", "error");
      }
    } catch (err) {
      setEmailVerified(false);
      const msg = err.message || "Unable to verify Gmail credentials.";
      setEmailTestState({
        status: "failed",
        message: msg,
      });
      showToast(msg, "error");
    } finally {
      setEmailTesting(false);
    }
  }

  function renderEmailConfig() {
    const hasKeysEntered = Boolean(draft.emailUser.trim() && draft.emailPassword.trim());
    const isPairVerified =
      emailVerified &&
      hasKeysEntered &&
      verifiedEmailPair.emailUser === draft.emailUser.trim().toLowerCase() &&
      verifiedEmailPair.emailPassword === draft.emailPassword.trim().replace(/\s+/g, "");

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
              <Mail size={20} />
            </span>
            <div>
              <h4 className="font-semibold text-slate-900">Mailer Configuration</h4>
              <p className="mt-1 text-sm text-slate-600">
                Use a custom Gmail account to send password reset links and security notifications.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-slate-500">Integration status</span>
            {isPairVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Verified
              </span>
            ) : hasKeysEntered ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Not verified
              </span>
            ) : customConfig.CUSTOM_EMAIL_USER?.configured || customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Active configuration
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Not configured
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Gmail account
            <input
              type="email"
              autoComplete="off"
              minLength={5}
              maxLength={100}
              value={draft.emailUser}
              onChange={(e) => {
                const val = e.target.value;
                setDraft({ ...draft, emailUser: val });
                if (emailVerified) setEmailVerified(false);
                if (emailTestState.status !== "untested") {
                  setEmailTestState({
                    status: "untested",
                    message: "Credentials have not yet been tested.",
                  });
                }
              }}
              placeholder={
                customConfig.CUSTOM_EMAIL_USER?.configured
                  ? "Saved · enter a replacement"
                  : "name@gmail.com"
              }
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Gmail app password
            <input
              type="password"
              autoComplete="new-password"
              minLength={16}
              maxLength={100}
              value={draft.emailPassword}
              onChange={(e) => {
                const val = e.target.value;
                setDraft({ ...draft, emailPassword: val });
                if (emailVerified) setEmailVerified(false);
                if (emailTestState.status !== "untested") {
                  setEmailTestState({
                    status: "untested",
                    message: "Credentials have not yet been tested.",
                  });
                }
              }}
              placeholder={
                customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured
                  ? "Saved securely · enter a replacement"
                  : "16-character app password"
              }
              className={inputClass}
            />
          </label>
        </div>

        {/* Credential verification */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/75 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Credential verification
            </span>
            {isPairVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <ShieldCheck size={14} /> Provider verified
              </span>
            )}
          </div>

          <p
            className={`text-xs ${
              isPairVerified
                ? "font-medium text-emerald-700"
                : emailTestState.status === "failed"
                  ? "font-medium text-red-600"
                  : emailTestState.status === "testing"
                    ? "font-medium text-blue-700"
                    : "text-slate-500"
            }`}
          >
            {isPairVerified
              ? emailTestState.message || "Credentials successfully verified with Gmail."
              : hasKeysEntered && emailTestState.status === "untested"
                ? "Credentials have not yet been tested."
                : emailTestState.message || "Credentials have not yet been tested."}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!hasKeysEntered || emailTesting || actionLocked}
              onClick={handleTestEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {emailTesting && <RefreshCw size={13} className="animate-spin text-blue-600" />}
              {emailTesting ? "Testing Credentials…" : "Test Credentials"}
            </button>
            <span className="text-[11px] text-slate-500">
              Performs an authenticated SMTP handshake with Google's mail server.
            </span>
          </div>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          The app password must remain on the backend. It is never returned in API responses, logs, or stored in frontend state beyond testing. Only tested and verified configurations can be saved.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionLocked || !isPairVerified || savingKey === "email"}
            onClick={() =>
              saveCustom("email", {
                CUSTOM_EMAIL_USER: draft.emailUser,
                CUSTOM_EMAIL_APP_PASSWORD: draft.emailPassword,
              })
            }
            className="rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingKey === "email" ? "Saving…" : "Save Configuration"}
          </button>
          <button
            type="button"
            disabled={
              actionLocked ||
              (!customConfig.CUSTOM_EMAIL_USER?.configured &&
                !customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured)
            }
            onClick={() =>
              saveCustom("email", {
                CUSTOM_EMAIL_USER: "",
                CUSTOM_EMAIL_APP_PASSWORD: "",
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use existing default
          </button>
        </div>
      </div>
    );
  }

  const customConfigRenderers = {
    google: renderGoogleConfig,
    recaptcha: renderRecaptchaConfig,
    email: renderEmailConfig,
  };

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <form onSubmit={handleAccessSubmit} className="w-full max-w-lg space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><ShieldCheck size={24} /></div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Restricted administrator access</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Verify with the super user</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Access to Admin Integrations relates to core and critical actions and requires permission from the developer/super user (SU). Enter the configured SU email to request an 8-digit verification code.
            </p>
          </div>
          {securityError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{securityError}</p>}
          {!accessChallengeId ? (
            <label className="block text-sm font-medium text-slate-700">
              Developer / super-user email
              <input
                type="email"
                autoComplete="email"
                minLength={5}
                maxLength={100}
                required
                value={accessEmail}
                onChange={(event) => setAccessEmail(event.target.value)}
                className={inputClass}
              />
            </label>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">The code was sent to the configured super user for secure relay. It expires in 5 minutes.</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 text-center mb-2">
                  8-digit verification code
                </label>
                <CodeInput
                  id="access-otp-input"
                  ariaLabel="8-digit verification code"
                  length={8}
                  value={accessCode}
                  onChange={(val) => setAccessCode(val)}
                  disabled={accessBusy}
                  hasError={Boolean(securityError)}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setAccessChallengeId(""); setAccessCode(""); setSecurityError(""); }}
                  className="text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  Use a different super-user email
                </button>
                {accessCode && (
                  <button
                    type="button"
                    onClick={() => setAccessCode("")}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear code
                  </button>
                )}
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={accessBusy || (!accessChallengeId ? !accessEmail.trim() : accessCode.length !== 8)}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {accessBusy ? "Verifying…" : accessChallengeId ? "Verify and open integrations" : "Request verification code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">
              System Administration
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Integration Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Enable or disable external technologies used by DNHS-SGMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {secondsRemaining !== null && secondsRemaining > 0 && (
              <div
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  secondsRemaining < 120
                    ? "border-amber-300 bg-amber-50 text-amber-800 animate-pulse"
                    : "border-slate-300 bg-white text-slate-700 shadow-sm"
                }`}
                title="Time remaining before Super-User MFA is required again"
              >
                <Clock size={14} className={secondsRemaining < 120 ? "text-amber-600" : "text-blue-600"} />
                <span>
                  Session: {Math.floor(secondsRemaining / 60)}:
                  {String(secondsRemaining % 60).padStart(2, "0")}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading || actionLocked}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {customWarning && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 shadow-sm"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
            <div className="space-y-1">
              <p className="font-semibold text-red-900">Credential Verification Failed</p>
              <p className="text-red-700">{customWarning}</p>
              <p className="text-xs text-red-600">The provided credentials could not be verified by the service (Google / Mailer) and were NOT saved. Existing settings remain unchanged.</p>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Plug size={22} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Connected technologies
              </h2>
              <p className="text-sm text-slate-500">
                Manage service settings, account security options, and their custom credentials.
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {INTEGRATIONS.map(({ key, title, description, detail, Icon, available, managementPath, customGroup }) => {
              const enabled = available || settings[key];
              const saving = savingKey === key;
              const isExpanded = Boolean(expandedConfig[key]);
              const hasCustomPanel = Boolean(customGroup && customConfigRenderers[customGroup]);
              const isUnlocked = Boolean(customGroup && unlockedConfigs[customGroup]);

              return (
                <article
                  key={key}
                  className="py-5"
                >
                  {/* ── Main row: info + toggle ── */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Icon size={22} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {title}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              key === "emailMailer"
                                ? "bg-blue-100 text-blue-800"
                                : enabled
                                ? "bg-green-100 text-green-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {key === "emailMailer" ? "Always On" : available ? "Available" : enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {description}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {hasCustomPanel && (
                        <button
                          type="button"
                          onClick={() => handleConfigureClick(customGroup, key)}
                          disabled={loading || actionLocked}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                            isExpanded
                              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              : isUnlocked
                              ? "border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100"
                              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                          aria-expanded={isExpanded}
                          title={isUnlocked ? "Custom credentials unlocked" : "Requires super-user PIN to configure"}
                        >
                          {isUnlocked ? (
                            <LockOpen size={14} className="text-emerald-600 shrink-0" />
                          ) : (
                            <Lock size={14} className="text-slate-400 shrink-0" />
                          )}
                          <span className="hidden sm:inline">Configure</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}

                      {managementPath ? (
                        <Link to={managementPath} className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">Manage passkeys</Link>
                      ) : key === "emailMailer" ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={true}
                          aria-label="Email Mailer is permanently enabled and unselectable"
                          disabled={true}
                          tabIndex={-1}
                          title="Email Mailer is permanently enabled for password recovery and cannot be toggled."
                          className="relative inline-flex h-7 w-12 shrink-0 cursor-not-allowed select-none items-center rounded-full bg-blue-700/60 opacity-60 pointer-events-none transition-colors"
                        >
                          <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform translate-x-6" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(enabled)}
                          aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
                          disabled={loading || actionLocked}
                          onClick={() => handleToggle(key)}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            enabled ? "bg-blue-700" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                              enabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                          {saving && (
                            <span className="sr-only">Saving setting</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Collapsible custom config panel ── */}
                  {hasCustomPanel && isExpanded && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                      {customConfigRenderers[customGroup]()}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {loading && (
            <p className="mt-4 text-sm text-slate-500">
              Loading integration settings…
            </p>
          )}
        </section>

        {/* ── Token signing secret — protected with Super-User PIN configure MFA ── */}
        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><KeyRound size={20} /></span>
              <div>
                <p className="text-sm font-medium text-blue-700">Security</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Token signing secret</h2>
                <p className="mt-1 text-sm text-slate-600">Signs login tokens used to protect administrator and user sessions.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConfigBadge active={Boolean(customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured)} />
              <button
                type="button"
                onClick={() => handleConfigureClick("token", "tokenSecret")}
                disabled={loading || actionLocked}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  expandedConfig["tokenSecret"]
                    ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : unlockedConfigs["token"]
                    ? "border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                aria-expanded={Boolean(expandedConfig["tokenSecret"])}
                title={unlockedConfigs["token"] ? "Token signing secret unlocked" : "Requires super-user PIN to configure"}
              >
                {unlockedConfigs["token"] ? (
                  <LockOpen size={14} className="text-emerald-600 shrink-0" />
                ) : (
                  <Lock size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="hidden sm:inline">Configure</span>
                {expandedConfig["tokenSecret"] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
          {expandedConfig["tokenSecret"] && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <label className="block text-sm font-medium text-slate-700">Custom secret<input type="password" autoComplete="new-password" minLength={32} maxLength={255} value={draft.tokenSecret} onChange={(e) => setDraft({ ...draft, tokenSecret: e.target.value })} placeholder={customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured ? "Saved securely · enter a replacement" : "Enter at least 32 characters"} className={inputClass} /></label>
              <p className="mt-2 text-xs leading-5 text-amber-800">Requires at least 32 characters and a server restart. Existing sessions will need to sign in again after the new secret takes effect.</p>
              <ConfigActions busy={savingKey === "token"} locked={actionLocked} configured={Boolean(customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured)} onSave={() => saveCustom("token", { CUSTOM_AUTH_TOKEN_SECRET: draft.tokenSecret })} onReset={() => saveCustom("token", { CUSTOM_AUTH_TOKEN_SECRET: "" })} disabled={!draft.tokenSecret.trim()} />
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700"><Cloud size={20} /></span>
              <div>
                <p className="text-sm font-medium text-green-700">Google Drive and Sheets</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Export connection</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Connect the administrator Google account used to save Activity Monitor exports and create Google Sheets.</p>
                <p className="mt-2 text-sm font-medium text-slate-700">{!googleStatus.available ? "Google OAuth is not configured on the server." : googleStatus.connected ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ""}` : "Not connected"}</p>
              </div>
            </div>
            {googleStatus.connected
              ? <button type="button" onClick={handleGoogleDisconnect} disabled={googleBusy || actionLocked} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{approvalRequesting ? "Requesting approval…" : googleBusy ? "Working…" : "Disconnect Google"}</button>
              : <button type="button" onClick={handleGoogleConnect} disabled={googleBusy || !googleStatus.available || actionLocked} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">{approvalRequesting ? "Requesting approval…" : googleBusy ? "Connecting…" : "Connect Google Drive"}</button>}
          </div>
        </section>

        <section className={cardClass}>
          <div>
            <p className="text-sm font-medium text-blue-700">Reports</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Report &amp; Data Export</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Export all Activity Monitor records in a printable or editable format.</p>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {[
              { key: "pdf", title: "PDF Export", description: "Generate a printable audit activity report.", Icon: FileText, action: "Export PDF" },
              { key: "xlsx", title: "Excel Export", description: "Export editable audit records as a spreadsheet.", Icon: FileSpreadsheet, action: "Export Excel" },
              { key: "csv", title: "CSV Export", description: "Download audit data in a portable CSV format.", Icon: Database, action: "Export CSV" },
            ].map(({ key, title, description, Icon, action }) => (
              <article key={key} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon size={22} /></div>
                  <div className="min-w-0"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Available</span>
                  <button type="button" onClick={() => handleExport(key)} disabled={Boolean(exportingFormat)} className="min-w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{exportingFormat === key ? "Preparing…" : action}</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">
            Security and configuration
          </h2>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            These switches control whether each integration is used. API keys
            and secret keys remain in the server environment and are not
            displayed here. Disabling reCAPTCHA removes that login challenge,
            so only do so when your school's security policy permits it.
          </p>
        </section>
      </div>
      {approval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <form onSubmit={handleApprovalSubmit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="approval-title">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><KeyRound size={22} /></div>
            <div>
              <h2 id="approval-title" className="text-lg font-bold text-slate-900">Super-user approval required</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">A one-time PIN was emailed to the super user. Ask them to relay it to approve this exact change. The PIN expires in 5 minutes and can be used once.</p>
            </div>
            {approval.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{approval.error}</p>}
            <div>
              <label className="block text-sm font-medium text-slate-700 text-center mb-2">
                8-digit SU PIN
              </label>
              <CodeInput
                id="su-pin-input"
                ariaLabel="8-digit Super-User PIN"
                length={8}
                value={approval.pin}
                onChange={(pin) => setApproval((current) => ({ ...current, pin }))}
                disabled={approvalBusy}
                hasError={Boolean(approval.error)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApproval(null)} disabled={approvalBusy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={approvalBusy || approval.pin.length !== 8} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{approvalBusy ? "Verifying…" : "Approve and apply change"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ConfigBadge({ active }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>
    {active ? "Custom override" : "Existing default"}
  </span>;
}

function ConfigActions({ busy, locked, configured, disabled, onSave, onReset }) {
  return <div className="mt-4 flex flex-wrap gap-2">
    <button type="button" disabled={locked || disabled} onClick={onSave} className="rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Save custom settings"}</button>
    <button type="button" disabled={locked || !configured} onClick={onReset} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Use existing default</button>
  </div>;
}

export default AdminIntegrations;
