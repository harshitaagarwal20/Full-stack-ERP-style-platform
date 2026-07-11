import { NavLink, useLocation } from "react-router-dom";
import { MenuIcon } from "./ErpIcons";

const BOTTOM_NAV_MAX = 4;

function ErpBottomNav({ items, onOpenMore }) {
  const location = useLocation();
  const hasMore = items.length > BOTTOM_NAV_MAX;
  const visibleItems = hasMore ? items.slice(0, BOTTOM_NAV_MAX) : items;
  const overflowItems = hasMore ? items.slice(BOTTOM_NAV_MAX) : [];

  // When the current route lives in the "More" drawer, highlight the More
  // button so the user still gets an active-state cue on any page.
  const isOverflowActive = overflowItems.some(
    (item) => item.to !== "/" && location.pathname.startsWith(item.to)
  );

  return (
    <nav className="erp-bottom-nav" aria-label="Bottom navigation">
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `erp-bottom-nav-item${isActive ? " active" : ""}`}
        >
          <span className="erp-bottom-nav-icon">{item.icon}</span>
          <span className="erp-bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
      {hasMore && (
        <button
          className={`erp-bottom-nav-item${isOverflowActive ? " active" : ""}`}
          onClick={onOpenMore}
          aria-label="More navigation options"
          aria-current={isOverflowActive ? "page" : undefined}
        >
          <span className="erp-bottom-nav-icon">
            <MenuIcon />
          </span>
          <span className="erp-bottom-nav-label">More</span>
        </button>
      )}
    </nav>
  );
}

export default ErpBottomNav;
