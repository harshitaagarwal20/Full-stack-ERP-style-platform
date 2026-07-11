const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "home", roles: ["admin", "sales"] },
  {
    key: "sales-group",
    label: "Sales",
    icon: "inbox",
    roles: ["admin", "sales"],
    children: [
      { to: "/enquiries", label: "Enquiries", roles: ["admin", "sales"] },
      { to: "/approval", label: "Approval", roles: ["admin", "sales"] },
      { to: "/orders", label: "Orders", roles: ["admin", "sales"] }
    ]
  },
  {
    key: "purchasing-group",
    label: "Purchasing",
    icon: "cart",
    roles: ["admin", "production"],
    children: [
      { to: "/purchase-orders", label: "Purchase Orders", roles: ["admin", "production"] },
      { to: "/grns", label: "Goods Receipts", roles: ["admin"] },
      { to: "/raw-materials", label: "Raw Materials", roles: ["admin"] }
    ]
  },
  {
    key: "production-group",
    label: "Production",
    icon: "factory",
    // Union of every child's roles — a group is visible if the user can see
    // at least one item inside it; per-child roles below do the real filtering.
    roles: ["admin", "production", "dispatch"],
    children: [
      { to: "/production", label: "Production", roles: ["admin", "production"] },
      { to: "/quality-check", label: "Quality Check", roles: ["admin", "production"] },
      { to: "/operation-log", label: "Operation Log", roles: ["admin", "production"] },
      { to: "/in-process-testing", label: "In-Process Testing", roles: ["admin", "production"] },
      { to: "/packing", label: "Packing", roles: ["admin", "production", "dispatch"] }
    ]
  },
  {
    key: "dispatch-group",
    label: "Dispatch",
    icon: "truck",
    roles: ["admin", "dispatch"],
    children: [
      { to: "/dispatch", label: "Dispatch", roles: ["admin", "dispatch"] },
      { to: "/pending-dispatch-date", label: "Dispatch Date", roles: ["admin", "dispatch"] }
    ]
  },
  {
    key: "admin-group",
    label: "Administration",
    icon: "clipboard",
    roles: ["admin"],
    children: [
      { to: "/activity-log", label: "Activity Log", roles: ["admin"] },
      { to: "/master-data", label: "Master Data", roles: ["admin"] },
      { to: "/supplier-data", label: "Supplier Data", roles: ["admin"] },
      { to: "/users", label: "Users", roles: ["admin"] }
    ]
  }
];

function itemVisibleToRole(item, role) {
  return !item.roles || item.roles.includes(role);
}

// Sidebar shape: groups stay nested, but each child (and the group itself)
// is filtered by role — a group only appears if at least one child survives.
export function getNavItemsByRole(role) {
  if (!role) return [];

  return NAV_ITEMS.map((item) => {
    if (item.children) {
      const children = item.children.filter((child) => itemVisibleToRole(child, role));
      if (children.length === 0) return null;
      return { ...item, children };
    }
    return itemVisibleToRole(item, role) ? item : null;
  }).filter(Boolean);
}

// Flat shape (groups expanded to their children) — used by the mobile
// bottom-nav quick-access bar and for matching the current route to a label,
// where a nested group isn't itself a navigable destination.
export function getFlatNavItemsByRole(role) {
  return getNavItemsByRole(role).flatMap((item) =>
    item.children ? item.children.map((child) => ({ icon: item.icon, ...child })) : [item]
  );
}
