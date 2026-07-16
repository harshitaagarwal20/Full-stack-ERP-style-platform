import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";

// Pass `module` to gate a route on the admin-configured module access (the
// backend enforces the same rule server-side). `roles` is still honoured for
// the few routes that aren't tied to a module.
function ProtectedRoute({ roles, module, level = "VIEW" }) {
  const { user, isAuthenticated } = useAuth();
  const { can, loading } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (module) {
    // Don't redirect before we know what the user may see, otherwise a hard
    // refresh on a permitted page would bounce them to the home route.
    if (loading) return null;
    if (!can(module, level)) return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
