// Sidebar definition. Each entry names the permission module that governs it,
// so what a user sees follows whatever the admin configured on the Role
// Management screen — there are no hard-coded role lists here any more.
const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "home", module: "dashboard" },
  {
    key: "purchasing-group",
    label: "Purchasing",
    icon: "cart",
    children: [
      { to: "/purchase-orders", label: "Purchase Orders", module: "purchase_orders" },
      { to: "/grns", label: "Goods Receipts", module: "grns" },
      { to: "/raw-materials", label: "Raw Materials", module: "inventory" }
    ]
  },
  {
    key: "sales-group",
    label: "Sales",
    icon: "inbox",
    children: [
      { to: "/enquiries", label: "Enquiries", module: "enquiries" },
      { to: "/approval", label: "Approval", module: "enquiries" },
      { to: "/orders", label: "Orders", module: "orders" }
    ]
  },
  {
    key: "production-group",
    label: "Production",
    icon: "factory",
    children: [
      { to: "/production", label: "Production", module: "production" },
      { to: "/quality-check", label: "Quality Check", module: "production" },
      { to: "/operation-log", label: "Operation Log", module: "production" },
      { to: "/in-process-testing", label: "In-Process Testing", module: "production" },
      { to: "/packing", label: "Packing", module: "packing" }
    ]
  },
  {
    key: "dispatch-group",
    label: "Dispatch",
    icon: "truck",
    children: [
      { to: "/dispatch", label: "Dispatch", module: "dispatch" },
      { to: "/pending-dispatch-date", label: "Dispatch Date", module: "dispatch" },
      { to: "/payments", label: "Payments", module: "payments" }
    ]
  },
  {
    key: "admin-group",
    label: "Administration",
    icon: "clipboard",
    children: [
      { to: "/master-data", label: "Master Data", module: "master_data" },
      { to: "/dropdown-masters", label: "Dropdown Masters", module: "master_data" },
      { to: "/supplier-data", label: "Supplier Data", module: "master_data" },
      { to: "/product-data", label: "Product Master", module: "master_data" },
      { to: "/users", label: "Users", module: "users" },
      // Not module-gated: granting a role access to the Users module must not
      // also let it rewrite the permission matrix. Admin only.
      { to: "/role-management", label: "Role Management", adminOnly: true }
    ]
  }
];

function itemVisible(item, can, isAdmin) {
  if (item.adminOnly && !isAdmin) return false;
  return !item.module || can(item.module, "VIEW");
}

// Sidebar shape: groups stay nested, but each child (and the group itself) is
// filtered by what the user may actually reach — a group only appears if at
// least one child survives.
export function getNavItems(can, isAdmin = false) {
  if (typeof can !== "function") return [];

  return NAV_ITEMS.map((item) => {
    if (item.children) {
      const children = item.children.filter((child) => itemVisible(child, can, isAdmin));
      if (children.length === 0) return null;
      return { ...item, children };
    }
    return itemVisible(item, can, isAdmin) ? item : null;
  }).filter(Boolean);
}

// Flat shape (groups expanded to their children) — used by the mobile bottom-nav
// and for matching the current route to a label, where a nested group isn't
// itself a navigable destination.
export function getFlatNavItems(can, isAdmin = false) {
  return getNavItems(can, isAdmin).flatMap((item) =>
    item.children ? item.children.map((child) => ({ icon: item.icon, ...child })) : [item]
  );
}
