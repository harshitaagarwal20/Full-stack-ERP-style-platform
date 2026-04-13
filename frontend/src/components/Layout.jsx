import { useAuth } from "../context/AuthContext";
import useIsMobile from "../hooks/useIsMobile";
import AdminLayout from "./layouts/AdminLayout";
import MobileLayout from "./layouts/MobileLayout";

function Layout() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  if (!user) return null;
  return isMobile ? <MobileLayout /> : <AdminLayout />;
}

export default Layout;
