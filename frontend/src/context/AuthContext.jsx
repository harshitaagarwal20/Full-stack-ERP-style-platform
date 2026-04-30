import { createContext, useEffect, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";

const AuthContext = createContext(null);

function safeParseStoredUser(raw) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredUser() {
  try {
    return safeParseStoredUser(localStorage.getItem("fms_user"));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(readStoredUser);

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
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const handleAuthExpired = (event) => {
      const message = event?.detail?.message || "Session expired. Please sign in again.";
      localStorage.removeItem("fms_token");
      localStorage.removeItem("fms_user");
      setUser(null);
      navigate("/login", {
        replace: true,
        state: { message }
      });
    };

    window.addEventListener("fms-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("fms-auth-expired", handleAuthExpired);
  }, [navigate]);

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
