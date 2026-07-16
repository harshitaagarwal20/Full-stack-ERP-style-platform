import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";
import { logApiError } from "../utils/apiError";

// The grid is driven by these local lists, not by the API payload, so it always
// renders something an admin can act on. The server only supplies the current
// levels; if that call fails or comes back empty, the grid still shows with
// everything at its stored value (or No Access) and an error banner explains why.
// Keep in step with backend/src/config/permissions.js.
const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "enquiries", label: "Enquiries & Approvals" },
  { key: "orders", label: "Orders" },
  { key: "manual_orders", label: "Manual Order Requests" },
  { key: "production", label: "Production & QC" },
  { key: "packing", label: "Packing" },
  { key: "dispatch", label: "Dispatch" },
  { key: "purchase_orders", label: "Purchase Orders" },
  { key: "grns", label: "Goods Receipts" },
  { key: "inventory", label: "Inventory & Stock" },
  { key: "bom", label: "Bill of Materials" },
  { key: "customers", label: "Customers" },
  { key: "master_data", label: "Master Data" },
  { key: "users", label: "Users" }
];

const ROLES = ["sales", "production", "dispatch", "purchase", "accounts"];
const LEVELS = ["NONE", "VIEW", "FULL"];

const LEVEL_LABEL = {
  NONE: "No Access",
  VIEW: "View Only",
  FULL: "View & Edit"
};

function prettyRole(role) {
  return String(role || "").replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyMatrix() {
  const matrix = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const mod of MODULES) matrix[role][mod.key] = "NONE";
  }
  return matrix;
}

// Merge whatever the server sent over a complete NONE-filled grid, so a missing
// role or module can never collapse the table.
function mergeMatrix(serverMatrix) {
  const merged = emptyMatrix();
  for (const role of ROLES) {
    for (const mod of MODULES) {
      const level = serverMatrix?.[role]?.[mod.key];
      if (LEVELS.includes(level)) merged[role][mod.key] = level;
    }
  }
  return merged;
}

function RoleManagementPage() {
  const { user } = useAuth();
  const { refresh } = usePermissions();
  const isAdmin = user?.role === "admin";

  const [matrix, setMatrix] = useState(emptyMatrix);
  const [original, setOriginal] = useState(emptyMatrix);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    setMessage("");
    try {
      const { data } = await api.get("/roles/permissions");
      const merged = mergeMatrix(data?.matrix);
      setMatrix(merged);
      setOriginal(merged);
    } catch (error) {
      setLoadError(
        error?.response?.status
          ? `Could not load the saved permissions (HTTP ${error.response.status}). The grid below shows defaults — saving will overwrite what is stored.`
          : `Could not reach the server (${error?.message || "unknown error"}). The grid below shows defaults.`
      );
      logApiError(error, "Failed to load role permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Send only what changed, so two admins editing different roles don't
  // overwrite each other's untouched cells.
  const changes = useMemo(() => {
    const diff = {};
    for (const role of ROLES) {
      for (const mod of MODULES) {
        const next = matrix[role]?.[mod.key] || "NONE";
        if (next !== (original[role]?.[mod.key] || "NONE")) {
          diff[role] = diff[role] || {};
          diff[role][mod.key] = next;
        }
      }
    }
    return diff;
  }, [matrix, original]);

  const changeCount = useMemo(
    () => Object.values(changes).reduce((sum, mods) => sum + Object.keys(mods).length, 0),
    [changes]
  );

  const setLevel = (role, moduleKey, level) => {
    setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [moduleKey]: level } }));
    setMessage("");
  };

  const save = async () => {
    if (changeCount === 0) return;
    setSaving(true);
    setMessage("");
    try {
      const { data } = await api.put("/roles/permissions", { matrix: changes });
      const merged = mergeMatrix(data?.matrix);
      setMatrix(merged);
      setOriginal(merged);
      setLoadError("");
      setMessage(`Saved — ${changeCount} permission${changeCount === 1 ? "" : "s"} updated. It takes effect immediately.`);
      refresh(); // the admin's own sidebar reads from the same data
    } catch (error) {
      logApiError(error, "Failed to save role permissions");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="erp-panel">
        <div className="erp-section-head">
          <h3>Role Management</h3>
          <p>Only an admin can change who has access to what.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="enquiry-page">
      <section className="enquiry-card enquiry-header-card">
        <div className="enquiry-header-left">
          <h2>Role Management</h2>
        </div>
        <div className="enquiry-header-actions">
          {changeCount > 0 && <span className="enquiry-pending-badge">Unsaved: {changeCount}</span>}
          <button className="enquiry-btn-secondary" onClick={load} disabled={saving || loading}>
            Reset
          </button>
          <button className="enquiry-btn-primary" onClick={save} disabled={saving || changeCount === 0}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-section-head">
          <h3>Module access by role</h3>
          <p>
            Set what each role can reach. <strong>View Only</strong> allows reading;{" "}
            <strong>View &amp; Edit</strong> also allows creating, changing and deleting. Admin
            always has full access and cannot be edited here, so you can never lock yourself out.
          </p>
        </div>

        {loadError && (
          <p style={{ margin: "0 0 12px", color: "#b91c1c", fontWeight: 600 }}>{loadError}</p>
        )}
        {message && (
          <p style={{ margin: "0 0 12px", color: "#15803d", fontWeight: 600 }}>{message}</p>
        )}
        {loading && <p style={{ margin: "0 0 12px", color: "#64748b" }}>Loading saved permissions…</p>}

        <div className="enquiry-table-wrap">
          <table className="enquiry-table">
            <thead>
              <tr>
                <th>Module</th>
                {ROLES.map((role) => (
                  <th key={role}>{prettyRole(role)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => (
                <tr key={mod.key}>
                  <td><strong>{mod.label}</strong></td>
                  {ROLES.map((role) => {
                    const level = matrix[role]?.[mod.key] || "NONE";
                    const dirty = (original[role]?.[mod.key] || "NONE") !== level;
                    return (
                      <td key={role}>
                        <select
                          value={level}
                          disabled={loading || saving}
                          onChange={(e) => setLevel(role, mod.key, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: `1px solid ${dirty ? "#2563eb" : "#cbd5e1"}`,
                            fontWeight: dirty ? 600 : 400,
                            background: "#fff",
                            color: "#334155"
                          }}
                        >
                          {LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>{LEVEL_LABEL[lvl]}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-section-head">
          <h3>Rules that stay fixed</h3>
          <p>
            These are business rules rather than access settings, so they always apply on top of
            the table above — granting a module here does not override them.
          </p>
        </div>
        <ul style={{ margin: 0, paddingLeft: "18px", color: "#475569", lineHeight: 1.9 }}>
          <li>Purchase order pricing (unit price, tax, discount, freight) — <strong>admin and accounts only</strong>.</li>
          <li>Releasing a purchase order to the supplier — <strong>admin and accounts only</strong>.</li>
          <li>Deleting a purchase order — <strong>admin only</strong>.</li>
          <li>Raising and approving a manual order request — <strong>admin and sales only</strong>.</li>
          <li>Setting a manual order's dispatch date — <strong>admin and dispatch only</strong>.</li>
        </ul>
      </section>
    </div>
  );
}

export default RoleManagementPage;
