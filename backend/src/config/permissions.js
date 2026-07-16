// Module-level access control, editable by an admin at runtime.
//
// A role gets one of three levels per module:
//   NONE  - cannot see it at all
//   VIEW  - read-only (GET)
//   FULL  - read and write (POST/PUT/PATCH/DELETE)
//
// The defaults below are a faithful copy of the role lists that used to be
// hard-coded into the route files, so turning this on changes nothing until an
// admin actually edits something.
//
// Some rules are deliberately NOT expressible here and stay in code, because
// they are business rules rather than access policy — e.g. only accounts/admin
// may price a PO or release it to the supplier, only admin may confirm a GRN.
// Module permissions decide whether you can reach the purchasing screens at
// all; those narrower guards still apply on top.

export const PERMISSION_LEVELS = ["NONE", "VIEW", "FULL"];

export const MODULES = [
  { key: "dashboard",     label: "Dashboard" },
  { key: "enquiries",     label: "Enquiries & Approvals" },
  { key: "orders",        label: "Orders" },
  { key: "manual_orders", label: "Manual Order Requests" },
  { key: "production",    label: "Production & QC" },
  { key: "packing",       label: "Packing" },
  { key: "dispatch",      label: "Dispatch" },
  { key: "purchase_orders", label: "Purchase Orders" },
  { key: "grns",          label: "Goods Receipts" },
  { key: "inventory",     label: "Inventory & Stock" },
  { key: "bom",           label: "Bill of Materials" },
  { key: "customers",     label: "Customers" },
  { key: "payments",      label: "Payments (Accounts)" },
  { key: "master_data",   label: "Master Data" },
  { key: "users",         label: "Users" }
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

// Admin is not listed: it always has FULL on everything and is not editable,
// otherwise an admin could lock every admin out of the permissions screen.
export const DEFAULT_MATRIX = {
  sales: {
    payments: "VIEW",
    // Dashboard is admin-only by default. Admin always has full access to every
    // module, so leaving it out of every editable role here is what makes it so
    // — an admin can still grant it to a role on the Role Management screen.
    enquiries: "FULL",
    orders: "FULL",
    manual_orders: "FULL",
    customers: "FULL",
    master_data: "VIEW"
  },
  production: {
    production: "FULL",
    packing: "FULL",
    purchase_orders: "FULL",
    inventory: "FULL",
    bom: "VIEW",
    master_data: "VIEW"
  },
  dispatch: {
    dispatch: "FULL",
    packing: "FULL",
    manual_orders: "FULL",
    customers: "VIEW",
    master_data: "VIEW"
  },
  purchase: {
    purchase_orders: "FULL",
    grns: "VIEW",
    inventory: "VIEW",
    // Read-only, and not optional: the purchase-order form populates its item
    // picker (finished goods / raw materials / packing materials) and its unit
    // dropdown from master data. Without VIEW, GET /api/master-data 403s and
    // those dropdowns come up empty — for the very role whose job is raising POs.
    master_data: "VIEW"
  },
  accounts: {
    // The payments screen is the accounts department's own step at the end of
    // the order flow: they record what has been received and that is what
    // completes the order.
    payments: "FULL",
    orders: "VIEW",
    dispatch: "VIEW",
    purchase_orders: "FULL",
    grns: "VIEW",
    inventory: "VIEW",
    // Same reason as purchase: accounts prices the PO on the same form.
    master_data: "VIEW"
  }
};

export const EDITABLE_ROLES = Object.keys(DEFAULT_MATRIX);

export function levelFromMethod(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(String(method || "").toUpperCase()) ? "VIEW" : "FULL";
}

export function satisfies(level, required) {
  if (level === "FULL") return true;
  if (level === "VIEW") return required === "VIEW";
  return false;
}
