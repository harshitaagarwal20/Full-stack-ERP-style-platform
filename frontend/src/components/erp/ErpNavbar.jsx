import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, MenuIcon } from "./ErpIcons";

function ErpNavbar({ pageTitle, userName, onToggleSidebar, onLogout, onChangePassword, canInstall = false, onInstall }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const toggleProfile = () => {
    setShowProfileMenu((prev) => !prev);
  };

  return (
    <header className="erp-topbar">
      <div className="erp-topbar-left">
        <button className="erp-menu-btn" onClick={onToggleSidebar} aria-label="Open sidebar menu">
          <MenuIcon />
        </button>
        <h1 className="erp-page-title">{pageTitle}</h1>
      </div>

      <div className="erp-topbar-right">
        {canInstall && (
          <button className="erp-btn primary" onClick={onInstall}>
            Install App
          </button>
        )}
        <div className="erp-topbar-control" ref={profileRef}>
          <button
            className="erp-user-profile"
            onClick={toggleProfile}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
          >
            <span className="erp-avatar">{initials || "AU"}</span>
            <span className="erp-user-name">{userName}</span>
            <ChevronDownIcon />
          </button>
          {showProfileMenu && (
            <div className="erp-popover erp-profile-menu" role="menu">
              <button
                className="erp-profile-action"
                role="menuitem"
                onClick={() => { setShowProfileMenu(false); onChangePassword?.(); }}
              >
                Change Password
              </button>
              <button
                className="erp-profile-action danger erp-profile-logout"
                role="menuitem"
                onClick={() => { setShowProfileMenu(false); onLogout?.(); }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <button className="erp-btn danger soft erp-topbar-logout" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}

export default ErpNavbar;
