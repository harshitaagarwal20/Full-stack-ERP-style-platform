const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "home", roles: ["admin", "sales"] },
  { to: "/enquiries", label: "Enquiries", icon: "inbox", roles: ["admin", "sales"] },
  { to: "/approval", label: "Approval", icon: "check", roles: ["admin"] },
  { to: "/orders", label: "Orders", icon: "cart", roles: ["admin", "sales"] },
  { to: "/production", label: "Production", icon: "factory", roles: ["admin", "production"] },
  { to: "/dispatch", label: "Dispatch", icon: "truck", roles: ["admin", "dispatch"] },
  { to: "/pending-dispatch-date", label: "Dispatch Date", icon: "clipboard", roles: ["admin", "dispatch"] },
  { to: "/activity-log", label: "Activity Log", icon: "clipboard", roles: ["admin"] },
  { to: "/master-data", label: "Master Data", icon: "clipboard", roles: ["admin"] },
  { to: "/users", label: "Users", icon: "users", roles: ["admin"] }
];

export function getNavItemsByRole(role) {
  if (!role) return [];
  if (role === "admin") return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
