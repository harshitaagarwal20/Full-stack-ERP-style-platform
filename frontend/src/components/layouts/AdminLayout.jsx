import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getNavItemsByRole } from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import ErpNavbar from "../erp/ErpNavbar";
import ErpSidebar from "../erp/ErpSidebar";
import { CartIcon, CheckIcon, ClipboardIcon, FactoryIcon, HomeIcon, InboxIcon, TruckIcon, UsersIcon } from "../erp/ErpIcons";

const iconMap = {
  home: <HomeIcon />,
  inbox: <InboxIcon />,
  check: <CheckIcon />,
  cart: <CartIcon />,
  factory: <FactoryIcon />,
  truck: <TruckIcon />,
  users: <UsersIcon />,
  clipboard: <ClipboardIcon />
};

function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const items = useMemo(
    () => getNavItemsByRole(user?.role).map((item) => ({ ...item, icon: iconMap[item.icon] })),
    [user?.role]
  );

  const currentPageTitle = useMemo(() => {
    const matched = items.find((item) => item.to === location.pathname);
    return matched?.label || "Nimbasia";
  }, [items, location.pathname]);

  return (
    <div className="erp-shell">
      <ErpSidebar
        items={items}
        open={open}
        collapsed={collapsed}
        onClose={() => setOpen(false)}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {open && <button className="erp-overlay" onClick={() => setOpen(false)} aria-label="Close sidebar" />}

      <div className={`erp-main-panel ${collapsed ? "sidebar-collapsed" : ""}`}>
        <ErpNavbar
          pageTitle={currentPageTitle}
          userName={user?.name || "Admin User"}
          onToggleSidebar={() => setOpen((prev) => !prev)}
          onLogout={logout}
        />
        <main className="erp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
