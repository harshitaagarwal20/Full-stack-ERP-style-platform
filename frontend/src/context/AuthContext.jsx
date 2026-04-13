import { createContext, useEffect, useContext, useMemo, useState } from "react";
import api from "../api/axiosClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("fms_user");
    return raw ? JSON.parse(raw) : null;
  });

  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("fms_token", data.token);
      localStorage.setItem("fms_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("fms_token");
    localStorage.removeItem("fms_user");
    setUser(null);
  };

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener("fms-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("fms-auth-expired", handleAuthExpired);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(user)
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
