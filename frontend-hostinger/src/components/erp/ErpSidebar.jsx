import { NavLink } from "react-router-dom";
import { ChevronLeftIcon } from "./ErpIcons";

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
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `erp-nav-item ${isActive ? "active" : ""}`}
          >
            <span className="erp-nav-icon">{item.icon}</span>
            <span className="erp-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default ErpSidebar;
