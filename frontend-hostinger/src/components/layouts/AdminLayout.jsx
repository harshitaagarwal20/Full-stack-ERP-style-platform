import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getFlatNavItems, getNavItems } from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import api from "../../api/axiosClient";
import ErpNavbar from "../erp/ErpNavbar";
import ErpSidebar from "../erp/ErpSidebar";
import ErpBottomNav from "../erp/ErpBottomNav";
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
  const { can } = usePermissions();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [changePwError, setChangePwError] = useState("");
  const [changePwSuccess, setChangePwSuccess] = useState("");
  const [changePwSubmitting, setChangePwSubmitting] = useState(false);

  const isAdmin = user?.role === "admin";

  const items = useMemo(
    () => getNavItems(can, isAdmin).map((item) => ({
      ...item,
      icon: iconMap[item.icon],
      children: item.children?.map((child) => ({ ...child, icon: iconMap[child.icon] }))
    })),
    [can, isAdmin]
  );

  const flatItems = useMemo(
    () => getFlatNavItems(can, isAdmin).map((item) => ({ ...item, icon: iconMap[item.icon] })),
    [can, isAdmin]
  );

  const currentPageTitle = useMemo(() => {
    const matched = flatItems.find((item) => item.to === location.pathname);
    return matched?.label || "Nimbasia";
  }, [flatItems, location.pathname]);

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

  const openChangePassword = () => {
    setChangePwForm({ current_password: "", new_password: "", confirm_password: "" });
    setChangePwError("");
    setChangePwSuccess("");
    setChangePwOpen(true);
  };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    if (changePwForm.new_password.length < 6) {
      setChangePwError("New password must be at least 6 characters.");
      return;
    }
    if (changePwForm.new_password !== changePwForm.confirm_password) {
      setChangePwError("Passwords do not match.");
      return;
    }
    setChangePwSubmitting(true);
    setChangePwError("");
    try {
      await api.patch("/users/me/password", {
        current_password: changePwForm.current_password,
        new_password: changePwForm.new_password
      });
      setChangePwSuccess("Password updated successfully.");
      setChangePwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || "Failed to update password.";
      setChangePwError(msg);
    } finally {
      setChangePwSubmitting(false);
    }
  };

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
          onChangePassword={openChangePassword}
          canInstall={!isStandalone && Boolean(installPromptEvent)}
          onInstall={handleInstall}
        />
        <main className="erp-content">
          <Outlet />
        </main>
      </div>
      <ErpBottomNav items={flatItems} onOpenMore={() => setOpen(true)} />

      {changePwOpen && (
        <div className="users-modal-overlay">
          <div className="users-modal-card">
            <div className="users-modal-head">
              <div>
                <h3>Change Password</h3>
                <p>Update your account password.</p>
              </div>
              <button
                className="users-modal-close-btn"
                onClick={() => setChangePwOpen(false)}
                disabled={changePwSubmitting}
              >
                Close
              </button>
            </div>

            {changePwError && <p className="users-form-error">{changePwError}</p>}
            {changePwSuccess && <p style={{ color: "#16a34a", fontSize: 14, margin: "0 0 12px" }}>{changePwSuccess}</p>}

            <form className="users-form-grid" onSubmit={submitChangePassword} noValidate>
              <div>
                <label className="users-field-label">Current Password</label>
                <input
                  className="users-input"
                  type="password"
                  value={changePwForm.current_password}
                  onChange={(e) => setChangePwForm((prev) => ({ ...prev, current_password: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label className="users-field-label">New Password</label>
                <input
                  className="users-input"
                  type="password"
                  value={changePwForm.new_password}
                  onChange={(e) => setChangePwForm((prev) => ({ ...prev, new_password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="users-field-label">Confirm New Password</label>
                <input
                  className="users-input"
                  type="password"
                  value={changePwForm.confirm_password}
                  onChange={(e) => setChangePwForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="users-form-actions">
                <button
                  type="button"
                  className="users-btn users-btn-secondary"
                  onClick={() => setChangePwOpen(false)}
                  disabled={changePwSubmitting}
                >
                  Cancel
                </button>
                <button className="users-btn users-btn-primary min-width" disabled={changePwSubmitting}>
                  {changePwSubmitting ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;
