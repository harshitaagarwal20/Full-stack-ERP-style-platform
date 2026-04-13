import { NavLink } from "react-router-dom";
import { CartIcon, FactoryIcon, HomeIcon, InboxIcon, TruckIcon } from "../../erp/ErpIcons";

const iconMap = {
  home: HomeIcon,
  inbox: InboxIcon,
  cart: CartIcon,
  factory: FactoryIcon,
  truck: TruckIcon
};

function BottomNav({ navItems }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const Icon = iconMap[item.icon];
        return (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}>
            <span className="mobile-nav-icon"><Icon /></span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default BottomNav;
