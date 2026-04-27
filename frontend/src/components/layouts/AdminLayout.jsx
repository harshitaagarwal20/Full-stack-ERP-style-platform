import { useEffect, useMemo, useState } from "react";
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
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const items = useMemo(
    () => getNavItemsByRole(user?.role).map((item) => ({ ...item, icon: iconMap[item.icon] })),
    [user?.role]
  );

  const currentPageTitle = useMemo(() => {
    const matched = items.find((item) => item.to === location.pathname);
    return matched?.label || "Nimbasia";
  }, [items, location.pathname]);

  useEffect(() => {
    // Always close drawer after navigation on compact screens.
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const onViewportChange = (event) => {
      if (event.matches) {
        setOpen(false);
      }
    };
    mediaQuery.addEventListener("change", onViewportChange);
    return () => mediaQuery.removeEventListener("change", onViewportChange);
  }, []);

  useEffect(() => {
    const standaloneMode = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    setIsStandalone(Boolean(standaloneMode));

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const onAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPromptEvent) return;

    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

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
          canInstall={!isStandalone && Boolean(installPromptEvent)}
          onInstall={handleInstall}
        />
        <main className="erp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
