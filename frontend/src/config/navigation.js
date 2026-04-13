const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "home", roles: ["admin", "sales", "production", "dispatch"] },
  { to: "/enquiries", label: "Enquiries", icon: "inbox", roles: ["admin", "sales", "production", "dispatch"] },
  { to: "/approval", label: "Approval", icon: "check", roles: ["admin"] },
  { to: "/orders", label: "Orders", icon: "cart", roles: ["admin", "sales", "production", "dispatch"] },
  { to: "/production", label: "Production", icon: "factory", roles: ["admin", "sales", "production", "dispatch"] },
  { to: "/dispatch", label: "Dispatch", icon: "truck", roles: ["admin", "sales", "production", "dispatch"] },
  { to: "/pending-export-date", label: "Pending Export Date", icon: "clipboard", roles: ["admin", "dispatch"] },
  { to: "/activity-log", label: "Activity Log", icon: "clipboard", roles: ["admin"] },
  { to: "/users", label: "Users", icon: "users", roles: ["admin"] }
];

export function getNavItemsByRole(role) {
  if (!role) return [];
  if (role === "admin") return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
