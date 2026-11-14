
import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import {
  loginUser,
  loginWithGoogle as googleLoginRequest,
} from "../services/schoolDataService";

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
      };
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("dnhs_user");
    localStorage.removeItem("dnhs_token");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
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
