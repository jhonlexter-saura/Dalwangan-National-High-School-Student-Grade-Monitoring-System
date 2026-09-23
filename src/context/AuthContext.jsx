import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (username, password) => {
    // Temporary accounts for development
    const users = [
      {
        id: 1,
        username: "student",
        password: "student123",
        name: "Juan Dela Cruz",
        role: "student",
      },
      {
        id: 2,
        username: "teacher",
        password: "teacher123",
        name: "Maria Santos",
        role: "teacher",
      },
      {
        id: 3,
        username: "admin",
        password: "admin123",
        name: "DNHS Administrator",
        role: "admin",
      },
    ];

    const foundUser = users.find(
      (user) =>
        user.username === username &&
        user.password === password
    );

    if (!foundUser) {
      return {
        success: false,
        message: "Invalid username or password.",
      };
    }

    setUser(foundUser);

    return {
      success: true,
      user: foundUser,
    };
  };

  const logout = useCallback(() => {
  setUser(null);
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