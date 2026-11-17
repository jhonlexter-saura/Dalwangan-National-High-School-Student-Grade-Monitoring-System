
import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import {
  loginUser,
  loginWithGoogle as googleLoginRequest,
  getPasskeyLoginOptions,
  verifyPasskeyLogin,
  revokeIntegrationAccess,
} from "../services/schoolDataService";
import { startAuthentication } from "@simplewebauthn/browser";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("dnhs_user");
    const token = localStorage.getItem("dnhs_token");

    if (!savedUser || !token) {
      localStorage.removeItem("dnhs_user");
      localStorage.removeItem("dnhs_token");
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("dnhs_user");
      localStorage.removeItem("dnhs_token");
      return null;
    }
  });

  const updateUser = useCallback((updates) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;

      const nextUser = { ...currentUser, ...updates };
      localStorage.setItem("dnhs_user", JSON.stringify(nextUser));

      return nextUser;
    });
  }, []);

  const establishSession = useCallback((result) => {
    sessionStorage.removeItem("dnhs_integration_access");
    sessionStorage.removeItem("dnhs_integration_access_expires");
    setUser(result.user);
    localStorage.setItem("dnhs_token", result.token);
    localStorage.setItem("dnhs_user", JSON.stringify(result.user));

    return {
      success: true,
      user: result.user,
    };
  }, []);

  const login = async (email, password, captchaToken) => {
    try {
      const result = await loginUser({
        email,
        password,
        captchaToken,
      });

      return establishSession(result);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Login failed.",
        status: error.status,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
  };

  const loginWithGoogle = async (credential) => {
    try {
      const result = await googleLoginRequest(credential);
      return establishSession(result);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Google sign-in failed.",
        status: error.status,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
  };

  const loginWithPasskey = async (email) => {
    try {
      const { options } = await getPasskeyLoginOptions(email);
      const response = await startAuthentication({ optionsJSON: options });
      const result = await verifyPasskeyLogin({ response, challenge: options.challenge });
      return establishSession(result);
    } catch (error) {
      return {
        success: false,
        message: error.name === "NotAllowedError"
          ? "Passkey sign-in was cancelled or timed out."
          : error.message || "Passkey sign-in failed.",
        status: error.status,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("dnhs_user");
    localStorage.removeItem("dnhs_token");
    sessionStorage.removeItem("dnhs_integration_access");
    sessionStorage.removeItem("dnhs_integration_access_expires");
    void revokeIntegrationAccess();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        loginWithPasskey,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
