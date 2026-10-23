import { useEffect, useState } from "react";
import {
  Globe,
  ShieldCheck,
  Plug,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  getIntegrationSettings,
  updateIntegrationSetting,
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
];

function AdminIntegrations() {
  const [settings, setSettings] = useState({
    googleSignIn: true,
    recaptcha: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const result = await getIntegrationSettings();
      setSettings(result.settings);
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

export default AdminIntegrations;