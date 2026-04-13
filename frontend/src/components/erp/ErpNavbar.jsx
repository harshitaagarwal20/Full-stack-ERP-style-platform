import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, MenuIcon } from "./ErpIcons";

function ErpNavbar({ pageTitle, userName, onToggleSidebar, onLogout }) {
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
        <div className="erp-topbar-control" ref={profileRef}>
          <button
            className={`erp-user-profile `}
            
           
           
          >
            <span className="erp-avatar">{initials || "AU"}</span>
            <span className="erp-user-name">{userName}</span>
            
          </button>
      
        </div>

        <button className="erp-btn danger soft" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}

export default ErpNavbar;
