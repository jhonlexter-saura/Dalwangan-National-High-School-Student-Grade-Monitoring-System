import { useEffect, useState } from "react";
import {
  Globe,
  ShieldCheck,
  Mail,
  Plug,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Database,
  KeyRound,
} from "lucide-react";

import {
  getIntegrationSettings,
  updateIntegrationSetting,
  updateCustomIntegrationConfig,
} from "../../services/schoolDataService";

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
    title: "reCAPTCHA v2",
    description:
      "Require checkbox verification before users can log in with an email and password.",
    detail: "Uses the reCAPTCHA keys configured in the server environment.",
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
];

function AdminIntegrations() {
  const [settings, setSettings] = useState({
    googleSignIn: true,
    recaptcha: true,
    emailMailer: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customConfig, setCustomConfig] = useState({});
  const [draft, setDraft] = useState({
    databaseUri: "",
    tokenSecret: "",
    emailUser: "",
    emailPassword: "",
    googleClientId: "",
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
      setError(err.message || "Unable to load integration settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleToggle(key) {
    if (savingKey) return;

    const nextValue = !settings[key];
    setSavingKey(key);
    setError("");
    setNotice("");

    try {
      const result = await updateIntegrationSetting(key, nextValue);

      setSettings(result.settings);
      setNotice(result.message || "Integration setting saved.");
    } catch (err) {
      setError(err.message || "Unable to save the setting.");
    } finally {
      setSavingKey("");
    }
  }

  async function saveCustom(group, values) {
    if (savingKey) return;
    setSavingKey(group);
    setError("");
    setNotice("");
    try {
      const result = await updateCustomIntegrationConfig(values);
      setCustomConfig(result.customConfig || {});
      setNotice(result.message || "Custom settings saved.");
      const draftFieldByEnvKey = {
        CUSTOM_DATABASE_URI: "databaseUri",
        CUSTOM_AUTH_TOKEN_SECRET: "tokenSecret",
        CUSTOM_EMAIL_USER: "emailUser",
        CUSTOM_EMAIL_APP_PASSWORD: "emailPassword",
        CUSTOM_GOOGLE_CLIENT_ID: "googleClientId",
        CUSTOM_VITE_GOOGLE_CLIENT_ID: "googleClientId",
        CUSTOM_RECAPTCHA_SECRET_KEY: "recaptchaSecretKey",
        CUSTOM_VITE_RECAPTCHA_SITE_KEY: "recaptchaSiteKey",
      };
      setDraft((current) => ({ ...current, ...Object.fromEntries(Object.keys(values).map((key) => [draftFieldByEnvKey[key], ""])) }));
    } catch (err) {
      setError(err.message || "Unable to save custom settings.");
    } finally {
      setSavingKey("");
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
  const cardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

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
            disabled={loading || Boolean(savingKey)}
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

        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{notice}</span>
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
                Changes are saved to the database.
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {INTEGRATIONS.map(({ key, title, description, detail, Icon }) => {
              const enabled = settings[key];
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
                            enabled
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {enabled ? "Enabled" : "Disabled"}
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

                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(enabled)}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
                    disabled={loading || Boolean(savingKey)}
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

        <section className="space-y-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Bring your own credentials</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Custom configuration</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Add a custom value to override the existing server or frontend setting. Leave an override empty by choosing “Use existing default.” Secret values are stored in the matching environment file and are never shown after saving.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Database size={20} /></span><div><h3 className="font-semibold text-slate-900">Database connection</h3><p className="mt-1 text-sm text-slate-600">Use a separate MongoDB database for this school system.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_DATABASE_URI?.configured)} /></div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Custom MongoDB URI<input type="password" autoComplete="new-password" value={draft.databaseUri} onChange={(e) => setDraft({ ...draft, databaseUri: e.target.value })} placeholder={customConfig.CUSTOM_DATABASE_URI?.configured ? "Saved securely · enter a replacement" : "mongodb+srv://…"} className={inputClass} /></label>
              <p className="mt-2 text-xs leading-5 text-amber-800">The URI is tested before saving. Restart the server to switch databases; the current admin session may need to sign in again if the new database has different accounts.</p>
              <ConfigActions busy={savingKey === "database"} locked={Boolean(savingKey)} configured={Boolean(customConfig.CUSTOM_DATABASE_URI?.configured)} onSave={() => saveCustom("database", { CUSTOM_DATABASE_URI: draft.databaseUri })} onReset={() => saveCustom("database", { CUSTOM_DATABASE_URI: "" })} disabled={!draft.databaseUri.trim()} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><KeyRound size={20} /></span><div><h3 className="font-semibold text-slate-900">Token signing secret</h3><p className="mt-1 text-sm text-slate-600">Signs login tokens used to protect administrator and user sessions.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured)} /></div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Custom secret<input type="password" autoComplete="new-password" value={draft.tokenSecret} onChange={(e) => setDraft({ ...draft, tokenSecret: e.target.value })} placeholder={customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured ? "Saved securely · enter a replacement" : "Enter at least 32 characters"} className={inputClass} /></label>
              <p className="mt-2 text-xs leading-5 text-amber-800">Requires at least 32 characters and a server restart. Existing sessions will need to sign in again after the new secret takes effect.</p>
              <ConfigActions busy={savingKey === "token"} locked={Boolean(savingKey)} configured={Boolean(customConfig.CUSTOM_AUTH_TOKEN_SECRET?.configured)} onSave={() => saveCustom("token", { CUSTOM_AUTH_TOKEN_SECRET: draft.tokenSecret })} onReset={() => saveCustom("token", { CUSTOM_AUTH_TOKEN_SECRET: "" })} disabled={!draft.tokenSecret.trim()} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700"><Mail size={20} /></span><div><h3 className="font-semibold text-slate-900">Email mailer</h3><p className="mt-1 text-sm text-slate-600">Use a custom Gmail account to send password reset links.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_EMAIL_USER?.configured || customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured)} /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Gmail account<input type="email" autoComplete="off" value={draft.emailUser} onChange={(e) => setDraft({ ...draft, emailUser: e.target.value })} placeholder={customConfig.CUSTOM_EMAIL_USER?.configured ? "Saved · enter a replacement" : "name@gmail.com"} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">Gmail app password<input type="password" autoComplete="new-password" value={draft.emailPassword} onChange={(e) => setDraft({ ...draft, emailPassword: e.target.value })} placeholder={customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured ? "Saved securely · enter a replacement" : "16-character app password"} className={inputClass} /></label></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Credentials are checked with Gmail before saving. Blank fields keep the existing value; use the reset button to remove both custom overrides.</p>
              <ConfigActions busy={savingKey === "email"} locked={Boolean(savingKey)} configured={Boolean(customConfig.CUSTOM_EMAIL_USER?.configured || customConfig.CUSTOM_EMAIL_APP_PASSWORD?.configured)} onSave={() => saveCustom("email", { CUSTOM_EMAIL_USER: draft.emailUser, CUSTOM_EMAIL_APP_PASSWORD: draft.emailPassword })} onReset={() => saveCustom("email", { CUSTOM_EMAIL_USER: "", CUSTOM_EMAIL_APP_PASSWORD: "" })} disabled={!draft.emailUser.trim() || !draft.emailPassword.trim()} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700"><Globe size={20} /></span><div><h3 className="font-semibold text-slate-900">Google Sign-In</h3><p className="mt-1 text-sm text-slate-600">Set the OAuth client used by the sign-in page and server.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured)} /></div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Google OAuth Client ID<input type="text" autoComplete="off" value={draft.googleClientId} onChange={(e) => setDraft({ ...draft, googleClientId: e.target.value })} placeholder={customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured ? "Saved · enter a replacement" : "…apps.googleusercontent.com"} className={inputClass} /></label>
              <p className="mt-2 text-xs leading-5 text-slate-500">The public client ID updates on the login screen immediately. Google confirms the client is usable when sign-in is attempted.</p>
              <ConfigActions busy={savingKey === "google"} locked={Boolean(savingKey)} configured={Boolean(customConfig.CUSTOM_GOOGLE_CLIENT_ID?.configured || customConfig.CUSTOM_VITE_GOOGLE_CLIENT_ID?.configured)} onSave={() => saveCustom("google", { CUSTOM_GOOGLE_CLIENT_ID: draft.googleClientId, CUSTOM_VITE_GOOGLE_CLIENT_ID: draft.googleClientId })} onReset={() => saveCustom("google", { CUSTOM_GOOGLE_CLIENT_ID: "", CUSTOM_VITE_GOOGLE_CLIENT_ID: "" })} disabled={!draft.googleClientId.trim()} />
            </article>

            <article className={cardClass}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ShieldCheck size={20} /></span><div><h3 className="font-semibold text-slate-900">reCAPTCHA v2</h3><p className="mt-1 text-sm text-slate-600">Set the public checkbox site key and its private server secret.</p></div></div><ConfigBadge active={Boolean(customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured || customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured)} /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Site key<input type="text" autoComplete="off" value={draft.recaptchaSiteKey} onChange={(e) => setDraft({ ...draft, recaptchaSiteKey: e.target.value })} placeholder={customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured ? "Saved · enter a replacement" : "Public site key"} className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">Secret key<input type="password" autoComplete="new-password" value={draft.recaptchaSecretKey} onChange={(e) => setDraft({ ...draft, recaptchaSecretKey: e.target.value })} placeholder={customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured ? "Saved securely · enter a replacement" : "Private server key"} className={inputClass} /></label></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Keys are checked for format; Google verifies the key pair when a user completes the login challenge.</p>
              <ConfigActions busy={savingKey === "recaptcha"} locked={Boolean(savingKey)} configured={Boolean(customConfig.CUSTOM_RECAPTCHA_SECRET_KEY?.configured || customConfig.CUSTOM_VITE_RECAPTCHA_SITE_KEY?.configured)} onSave={() => saveCustom("recaptcha", { CUSTOM_RECAPTCHA_SECRET_KEY: draft.recaptchaSecretKey, CUSTOM_VITE_RECAPTCHA_SITE_KEY: draft.recaptchaSiteKey })} onReset={() => saveCustom("recaptcha", { CUSTOM_RECAPTCHA_SECRET_KEY: "", CUSTOM_VITE_RECAPTCHA_SITE_KEY: "" })} disabled={!draft.recaptchaSiteKey.trim() || !draft.recaptchaSecretKey.trim()} />
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
