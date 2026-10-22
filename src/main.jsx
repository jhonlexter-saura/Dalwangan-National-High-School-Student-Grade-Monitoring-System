
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";

import "./index.css";
import App from "./App.jsx";

import { AuthProvider } from "./context/AuthContext.jsx";
import { SchoolDataProvider } from "./context/SchoolDataContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
console.log(
  "Google Client ID configured:",
  Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
);
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider
      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
    >
      <AuthProvider>
        <SchoolDataProvider>
          <ToastProvider>
            <App />
            
          </ToastProvider>
        </SchoolDataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
