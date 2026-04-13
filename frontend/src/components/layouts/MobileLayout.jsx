import { Outlet, useLocation } from "react-router-dom";
import { getNavItemsByRole } from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import BottomNav from "../mobile/common/BottomNav";

function MobileLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navItems = getNavItemsByRole(user?.role).filter((item) => ["home", "inbox", "cart", "factory", "truck"].includes(item.icon));
  const activePage = navItems.find((item) => item.to === location.pathname)?.label || "Nimbasia";

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <div>
          <p className="mobile-header-role">{user?.role || "user"}</p>
          <h1 className="mobile-header-title">{activePage}</h1>
        </div>
        <button className="mobile-logout-btn" onClick={logout}>Logout</button>
      </header>

      <main className="mobile-main">
        <Outlet />
      </main>

      <BottomNav navItems={navItems} />
    </div>
  );
}

export default MobileLayout;
