import { useAuth } from "../context/AuthContext";
import AdminLayout from "./layouts/AdminLayout";

function Layout() {
  const { user } = useAuth();
  if (!user) return null;
  return <AdminLayout />;
}

export default Layout;
