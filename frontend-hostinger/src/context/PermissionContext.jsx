import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { useAuth } from "./AuthContext";

// What the signed-in user may reach, as configured by an admin on the Role
// Management screen. The backend is the real gate — this only decides what the
// sidebar and route guards show, so the user never walks into a 403.
const PermissionContext = createContext({
  permissions: {},
  loading: true,
  can: () => false,
  refresh: () => {}
});

// ProtectedRoute renders nothing while permissions are loading, so this request
// used to sit in front of everything: the app booted, waited ~300ms for it, and
// only then began downloading the route's chunk and firing its data calls — a
// serial chain on every single page load.
//
// The last known permissions are cached per user, so a returning session starts
// with them already in hand: the route renders immediately and the fetch below
// revalidates in the background. The backend is the real gate — a stale cache
// can only mis-draw the sidebar for a moment, never grant access.
const CACHE_KEY = "fms_permissions";

function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.userId === userId ? parsed.permissions : null;
  } catch {
    return null;
  }
}

function writeCache(userId, permissions) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, permissions }));
  } catch {
    // A full or unavailable sessionStorage just means no cache — not an error.
  }
}

export function PermissionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const cached = readCache(user?.id);
  const [permissions, setPermissions] = useState(cached || {});
  // Only block the routes when there is nothing to go on.
  const [loading, setLoading] = useState(!cached);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setPermissions({});
      setLoading(false);
      try {
        window.sessionStorage.removeItem(CACHE_KEY);
      } catch { /* nothing to clear */ }
      return;
    }

    try {
      const { data } = await api.get("/roles/my-permissions");
      const next = data?.permissions || {};
      setPermissions(next);
      writeCache(user?.id, next);
    } catch {
      // If this fails we deliberately grant nothing rather than guessing —
      // the backend would reject the calls anyway.
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    load();
  }, [load, user?.role]);

  const can = useCallback(
    (moduleKey, required = "VIEW") => {
      if (!moduleKey) return true;
      if (user?.role === "admin") return true;
      const level = permissions[moduleKey] || "NONE";
      if (level === "FULL") return true;
      return level === "VIEW" && required === "VIEW";
    },
    [permissions, user?.role]
  );

  const value = useMemo(
    () => ({ permissions, loading, can, refresh: load }),
    [permissions, loading, can, load]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export default PermissionContext;
