import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import { loginUser } from "../services/schoolDataService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("dnhs_user");

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("dnhs_user");
      return null;
    }
  });

  const login = async (email, password) => {
    try {
      const result = await loginUser({
        email,
        password,
      });

      setUser(result.user);

      localStorage.setItem("dnhs_token", result.token);
      localStorage.setItem(
        "dnhs_user",
        JSON.stringify(result.user)
      );

      return {
        success: true,
        user: result.user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}