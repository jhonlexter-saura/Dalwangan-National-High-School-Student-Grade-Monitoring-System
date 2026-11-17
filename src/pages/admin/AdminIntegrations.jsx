import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";

import {
  getIntegrationSettings,
  requestIntegrationAccessCode,
  verifyIntegrationAccessCode,
  requestIntegrationChangeApproval,
  updateIntegrationSetting,
  updateCustomIntegrationConfig,
  exportAuditLogs,
  getAuditLogExportData,
  getGoogleConnectUrl,
  getGoogleIntegrationStatus,
  disconnectGoogle,
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
  },
  {
    key: "recaptcha",
    title: "reCAPTCHA v3",
    description:
      "Verify password sign-ins invisibly with a risk score.",
    detail: "Uses the reCAPTCHA v3 site key and secret configured in the server environment.",
    Icon: ShieldCheck,
  },
  {
    key: "emailMailer",
    title: "Email Mailer",
    description:
      "Send password reset links to students and teachers by email.",
    detail: "Uses the Gmail mailer credentials configured on the server.",
    Icon: Mail,
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
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem("dnhs_integration_access") || "");
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
        setAccessToken("");
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
        setAccessToken("");
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
        sessionStorage.setItem("dnhs_integration_access", result.accessToken);
        setAccessToken(result.accessToken);
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
    await requestApprovedChange("custom-config", values, async (approved) => {
      setSavingKey(group);
      setError("");
      setCustomWarning("");
      try {
        const result = await updateCustomIntegrationConfig(values, approved);
        setCustomConfig(result.customConfig || {});
        setCustomWarning("");
        showToast(result.message || "Custom settings verified and saved.", "success", 6500);
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
        setDraft((current) => ({ ...current, ...Object.fromEntries(Object.keys(values).map((key) => [draftFieldByEnvKey[key], ""])) }));
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
              <input type="email" autoComplete="email" required value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} className={inputClass} />
            </label>
          ) : (
            <>
              <p className="text-sm text-slate-600">The code was sent to the configured super user for secure relay. It expires in 5 minutes.</p>
              <label className="block text-sm font-medium text-slate-700">
                8-digit verification code
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]{8}" required value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 8))} className={inputClass} />
              </label>
              <button type="button" onClick={() => { setAccessChallengeId(""); setAccessCode(""); setSecurityError(""); }} className="text-sm font-medium text-blue-700 hover:text-blue-900">Use a different super-user email</button>
            </>
          )}
          <button type="submit" disabled={accessBusy} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
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

          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || actionLocked}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
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
                Manage service settings and account security options.
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {INTEGRATIONS.map(({ key, title, description, detail, Icon, available, managementPath }) => {
              const enabled = available || settings[key];
              const saving = savingKey === key;

              return (
                <article
                  key={key}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
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

        <section className="space-y-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Bring your own credentials</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Custom configuration</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Add a custom value to override the existing server or frontend setting. Leave an override empty by choosing “Use existing default.” Secret values are stored in the matching environment file and are never shown after saving.
            </p>
          </div>

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

          <div className="grid gap-4 xl:grid-cols-2">
            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><KeyRound size={20} /></span><div><h3 className="font-semibold text-slate-900">Token signing secret</h3><p className="mt-1 text-sm text-slate-600">Signs login tokens used to protect administrator and user sessions.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured)} /></div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Custom secret<input type="password" autoComplete="new-password" value={draft.tokenSecret} onChange={(e) => setDraft({ ...draft, tokenSecret: e.target.value })} placeholder={customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured ? "Saved securely · enter a replacement" : "Enter at least 32 characters"} className={inputClass} /></label>
              <p className="mt-2 text-xs leading-5 text-amber-800">Requires at least 32 characters and a server restart. Existing sessions will need to sign in again after the new secret takes effect.</p>
              <ConfigActions busy={savingKey === "token"} locked={actionLocked} configured={Boolean(customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured)} onSave={() => saveCustom("token", { CUSTOM_AUTH_TOKEN_SECRET: draft.tokenSecret })} onReset={() => saveCustom("token", { CUSTOM_AUTH_TOKEN_SECRET: "" })} disabled={!draft.tokenSecret.trim()} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700"><Mail size={20} /></span><div><h3 className="font-semibold text-slate-900">Email mailer</h3><p className="mt-1 text-sm text-slate-600">Use a custom Gmail account to send password reset links.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_EMAIL_USER?.configured || customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured)} /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Gmail account<input type="email" autoComplete="off" value={draft.emailUser} onChange={(e) => setDraft({ ...draft, emailUser: e.target.value })} placeholder={customConfig.CUSTOM_EMAIL_USER?.configured ? "Saved · enter a replacement" : "name@gmail.com"} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">Gmail app password<input type="password" autoComplete="new-password" value={draft.emailPassword} onChange={(e) => setDraft({ ...draft, emailPassword: e.target.value })} placeholder={customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured ? "Saved securely · enter a replacement" : "16-character app password"} className={inputClass} /></label></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Credentials are checked with Gmail before saving. Blank fields keep the existing value; use the reset button to remove both custom overrides.</p>
              <ConfigActions busy={savingKey === "email"} locked={actionLocked} configured={Boolean(customConfig.CUSTOM_EMAIL_USER?.configured || customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured)} onSave={() => saveCustom("email", { CUSTOM_EMAIL_USER: draft.emailUser, CUSTOM_EMAIL_APP_PASSWORD: draft.emailPassword })} onReset={() => saveCustom("email", { CUSTOM_EMAIL_USER: "", CUSTOM_EMAIL_APP_PASSWORD: "" })} disabled={!draft.emailUser.trim() || !draft.emailPassword.trim()} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700"><Globe size={20} /></span><div><h3 className="font-semibold text-slate-900">Google OAuth credentials</h3><p className="mt-1 text-sm text-slate-600">Set the OAuth client used for sign-in and Drive exports.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_GOOGLE_CLIENT_SECRET?.configured)} /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Google OAuth Client ID<input type="text" autoComplete="off" value={draft.googleClientId} onChange={(e) => setDraft({ ...draft, googleClientId: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured ? "Saved · enter a replacement" : "…apps.googleusercontent.com"} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">Google OAuth Client Secret<input type="password" autoComplete="new-password" value={draft.googleClientSecret} onChange={(e) => setDraft({ ...draft, googleClientSecret: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_CLIENT_SECRET?.configured ? "Saved securely · enter a replacement" : "Server-side client secret"} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Google token encryption key<input type="password" autoComplete="new-password" value={draft.googleTokenKey} onChange={(e) => setDraft({ ...draft, googleTokenKey: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY?.configured ? "Saved securely · enter a replacement" : "At least 32 characters · keep this key stable"} className={inputClass} /></label></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">The client ID is public. The client secret and encryption key stay on the server and are never shown after saving. Keep the encryption key stable so saved Google connections remain usable. Configure the OAuth redirect URL as your server’s /api/v1/integrations/google/callback address.</p>
              <ConfigActions busy={savingKey === "google"} locked={actionLocked} configured={Boolean(customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_GOOGLE_CLIENT_SECRET?.configured || customConfig.CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY?.configured)} onSave={() => saveCustom("google", { CUSTOM_GOOGLE_CLIENT_ID: draft.googleClientId, CUSTOM_VITE_GOOGLE_CLIENT_ID: draft.googleClientId, CUSTOM_GOOGLE_CLIENT_SECRET: draft.googleClientSecret, CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY: draft.googleTokenKey })} onReset={() => saveCustom("google", { CUSTOM_GOOGLE_CLIENT_ID: "", CUSTOM_VITE_GOOGLE_CLIENT_ID: "", CUSTOM_GOOGLE_CLIENT_SECRET: "", CUSTOM_GOOGLE_TOKEN_ENCRYPTION_KEY: "" })} disabled={!draft.googleClientId.trim() || !draft.googleClientSecret.trim() || draft.googleTokenKey.trim().length < 32} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ShieldCheck size={20} /></span><div><h3 className="font-semibold text-slate-900">reCAPTCHA v3</h3><p className="mt-1 text-sm text-slate-600">Set the public v3 site key and its private server secret.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured || customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured)} /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Site key<input type="text" autoComplete="off" value={draft.recaptchaSiteKey} onChange={(e) => setDraft({ ...draft, recaptchaSiteKey: e.target.value })} placeholder={customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured ? "Saved · enter a replacement" : "Public site key"} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">Secret key<input type="password" autoComplete="new-password" value={draft.recaptchaSecretKey} onChange={(e) => setDraft({ ...draft, recaptchaSecretKey: e.target.value })} placeholder={customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured ? "Saved securely · enter a replacement" : "Private server key"} className={inputClass} /></label></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Keys are checked for format; Google verifies the key pair when a user completes the login challenge.</p>
              <ConfigActions busy={savingKey === "recaptcha"} locked={actionLocked} configured={Boolean(customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured || customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured)} onSave={() => saveCustom("recaptcha", { CUSTOM_RECAPTCHA_SECRET_KEY: draft.recaptchaSecretKey, CUSTOM_VITE_RECAPTCHA_SITE_KEY: draft.recaptchaSiteKey })} onReset={() => saveCustom("recaptcha", { CUSTOM_RECAPTCHA_SECRET_KEY: "", CUSTOM_VITE_RECAPTCHA_SITE_KEY: "" })} disabled={!draft.recaptchaSiteKey.trim() || !draft.recaptchaSecretKey.trim()} />
            </article>
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
            <label className="block text-sm font-medium text-slate-700">
              8-digit SU PIN
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]{8}" required value={approval.pin} onChange={(event) => setApproval((current) => ({ ...current, pin: event.target.value.replace(/\D/g, "").slice(0, 8) }))} className={inputClass} />
            </label>
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
