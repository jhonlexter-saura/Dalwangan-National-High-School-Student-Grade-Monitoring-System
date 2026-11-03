
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";

import "./index.css";
import App from "./App.jsx";

import { AuthProvider } from "./context/AuthContext.jsx";
import { SchoolDataProvider } from "./context/SchoolDataContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";

import { getPublicIntegrationSettings } from "./services/schoolDataService.js";

function RootApp() {
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || "");

  useEffect(() => {
    let active = true;
    const refreshPublicConfig = () => {
      getPublicIntegrationSettings()
        .then((result) => {
          if (active && result.settings?.googleClientId !== undefined) {
            setGoogleClientId(result.settings.googleClientId);
          }
        })
        .catch(() => {});
    };
    refreshPublicConfig();
    window.addEventListener("dnhs:integration-config-updated", refreshPublicConfig);
    return () => {
      active = false;
      window.removeEventListener("dnhs:integration-config-updated", refreshPublicConfig);
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <SchoolDataProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SchoolDataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);
