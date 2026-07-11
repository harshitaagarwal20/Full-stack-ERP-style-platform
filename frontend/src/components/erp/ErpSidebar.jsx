import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeftIcon, ChevronDownIcon } from "./ErpIcons";

function NavGroup({ item, onClose }) {
  const location = useLocation();
  const hasActiveChild = item.children.some((child) => child.to === location.pathname);
  const [expanded, setExpanded] = useState(hasActiveChild);

  return (
    <div className={`erp-nav-group ${expanded ? "is-expanded" : ""}`}>
      <button
        type="button"
        className={`erp-nav-item erp-nav-group-toggle ${hasActiveChild ? "active" : ""}`}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="erp-nav-icon">{item.icon}</span>
        <span className="erp-nav-label">{item.label}</span>
        <span className="erp-nav-chevron"><ChevronDownIcon /></span>
      </button>
      {expanded && (
        <div className="erp-nav-subgroup">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onClose}
              className={({ isActive }) => `erp-nav-item erp-nav-subitem ${isActive ? "active" : ""}`}
            >
              <span className="erp-nav-label">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function ErpSidebar({ items, open, collapsed, onClose, onToggleCollapse }) {
  return (
    <aside className={`erp-sidebar ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <div className="erp-brand">

        <div className="erp-brand-copy">
          <p className="erp-brand-title">Nimbasia Stabilizers</p>
        </div>
        <button className="erp-collapse-btn" onClick={onToggleCollapse} aria-label="Collapse sidebar">
          <ChevronLeftIcon />
        </button>
      </div>

      <nav className="erp-nav">
        {items.map((item) =>
          item.children ? (
            <NavGroup key={item.key || item.label} item={item} onClose={onClose} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `erp-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="erp-nav-icon">{item.icon}</span>
              <span className="erp-nav-label">{item.label}</span>
            </NavLink>
          )
        )}
      </nav>
    </aside>
  );
}

export default ErpSidebar;
