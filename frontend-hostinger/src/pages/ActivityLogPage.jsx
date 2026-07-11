import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import MobileListCard from "../components/common/MobileListCard";
import { ClipboardIcon, SearchIcon } from "../components/erp/ErpIcons";
import { useIsMobile } from "../hooks/useIsMobile";
import { exportRowsToExcel } from "../utils/exportExcel";
import { sanitizeAuditValue } from "../utils/auditLog";
import { logApiError } from "../utils/apiError";
import { sortByNewestFirst } from "../utils/recordOrdering";
import SearchableSelect from "../components/common/SearchableSelect";

const actionLabels = {
  APPROVE_ENQUIRY: "Approve Enquiry",
  REJECT_ENQUIRY: "Reject Enquiry",
  CREATE_ORDER: "Create Order",
  UPDATE_ORDER: "Update Order",
  START_PRODUCTION: "Start Production",
  COMPLETE_PRODUCTION: "Complete Production",
  UPDATE_PRODUCTION: "Update Production",
  CREATE_DISPATCH: "Create Dispatch",
  UPDATE_DISPATCH: "Update Dispatch",
  DELETE_ENQUIRY: "Delete Enquiry",
  DELETE_ORDER: "Delete Order",
  DELETE_PRODUCTION: "Delete Production",
  DELETE_DISPATCH: "Delete Dispatch"
};

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function prettyValue(value) {
  if (value == null) return "-";
  try {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getTone(action) {
  if (action.startsWith("DELETE")) return "activity-delete";
  if (action.includes("APPROVE") || action.includes("START") || action.includes("CREATE")) return "activity-success";
  if (action.includes("REJECT")) return "activity-danger";
  if (action.includes("COMPLETE")) return "activity-complete";
  return "activity-update";
}

function ActivityLogPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const isMobile = useIsMobile();
  const [selectedLog, setSelectedLog] = useState(null);
  const [totalLogCount, setTotalLogCount] = useState(0);
  const tableWrapRef = useRef(null);

  // Cap the fetch instead of pulling the entire audit history every load —
  // this only shows the most recent LOG_FETCH_LIMIT entries, which keeps the
  // request bounded as the log grows. Search/filter still run client-side
  // within that window rather than a full server-paginated table, since the
  // action/entity filter dropdowns are derived from whatever's loaded.
  const LOG_FETCH_LIMIT = 500;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/audit-logs", { params: { limit: LOG_FETCH_LIMIT } });
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setLogs(sortByNewestFirst(items));
      setTotalLogCount(Number(data?.pagination?.total ?? items.length));
    } catch (error) {
      logApiError(error, "Failed to load activity log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const actionOptions = useMemo(() => {
    const values = Array.from(new Set(logs.map((log) => log.action))).sort();
    return ["ALL", ...values];
  }, [logs]);

  const entityOptions = useMemo(() => {
    const values = Array.from(new Set(logs.map((log) => log.entityType))).sort();
    return ["ALL", ...values];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionFilter === "ALL" || log.action === actionFilter;
      const matchesEntity = entityFilter === "ALL" || log.entityType === entityFilter;
      const matchesQuery = !query
        || [log.action, log.entityType, log.actorName, String(log.entityId ?? "")]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesAction && matchesEntity && matchesQuery;
    });
  }, [logs, searchText, actionFilter, entityFilter]);

  const exportToExcel = () => {
    const columns = [
      { key: "time",     header: "Time" },
      { key: "action",   header: "Action" },
      { key: "module",   header: "Module" },
      { key: "recordId", header: "Record ID" },
      { key: "user",     header: "User" },
      { key: "role",     header: "Role" }
    ];
    const rows = filteredLogs.map((log) => ({
      time:     formatDateTime(log.createdAt),
      action:   actionLabels[log.action] || log.action || "-",
      module:   log.entityType || "-",
      recordId: log.entityId ?? "-",
      user:     log.actorName || log.actor?.name || "System",
      role:     log.actorRole || log.actor?.role || "-"
    }));
    exportRowsToExcel("activity-log", columns, rows);
  };

  return (
    <div className="activity-page">
      <section className="activity-card activity-header-card">
        <div className="activity-title-block">
          <div className="activity-icon">
            <ClipboardIcon />
          </div>
          <div>
            <h2>Activity Log</h2>
            </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
          <button className="activity-refresh-btn" onClick={fetchLogs}>Refresh</button>
        </div>
      </section>

      <section className="activity-card">
        <div className="activity-toolbar">
          <div className="activity-search">
            <SearchIcon />
            <input
              placeholder="Search action, module, user, or record ID"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          <div className="activity-filter-grid">
            <SearchableSelect
              options={actionOptions.map((option) => ({ value: option, label: option === "ALL" ? "All Actions" : actionLabels[option] || option }))}
              value={actionFilter}
              onChange={(value) => setActionFilter(value)}
              placeholder="All Actions"
            />
            <SearchableSelect
              options={entityOptions.map((option) => ({ value: option, label: option === "ALL" ? "All Modules" : option }))}
              value={entityFilter}
              onChange={(value) => setEntityFilter(value)}
              placeholder="All Modules"
            />
          </div>
        </div>

        {loading ? (
          <div className="activity-empty">Loading activity log...</div>
        ) : filteredLogs.length ? (
          <>
          {!isMobile && <div className="activity-table-wrap" ref={tableWrapRef}>
            <div className="activity-table-meta">
              Showing {filteredLogs.length} activity record{filteredLogs.length === 1 ? "" : "s"}
              {totalLogCount > logs.length ? ` (most recent ${logs.length} of ${totalLogCount} total)` : ""}
            </div>
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Record ID</th>
                  <th>User</th>
                  <th>Note</th>

                </tr>
              </thead>
              <VirtualizedTableBody
                rows={filteredLogs}
                colSpan={6}
                rowHeight={52}
                overscan={10}
                scrollContainerRef={tableWrapRef}
                getRowKey={(log) => log.id}
                renderRow={(log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>
                      <span className={`activity-badge ${getTone(log.action)}`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td>{log.entityType}</td>
                    <td>{log.entityId ?? "-"}</td>
                    <td>
                      <div className="activity-user">
                        <strong>{log.actorName || log.actor?.name || "System"}</strong>
                        <span>{log.actorRole || log.actor?.role || "-"}</span>
                      </div>
                    </td>
                    <td>
                      <button className="activity-view-btn" onClick={() => setSelectedLog(log)}>
                        View
                      </button>
                    </td>
                  </tr>
                )}
              />
            </table>
          </div>}

          {isMobile && <div className="order-mobile-list">
            {filteredLogs.map((log) => (
              <MobileListCard
                key={log.id}
                title={actionLabels[log.action] || log.action}
                subtitle={log.entityType}
                badge={log.entityId ?? "-"}
                badgeColor={getTone(log.action) === "activity-delete" ? "red" : getTone(log.action) === "activity-success" ? "green" : getTone(log.action) === "activity-complete" ? "blue" : getTone(log.action) === "activity-danger" ? "orange" : "default"}
                fields={[
                  { label: "User", value: log.actorName || log.actor?.name || "System" },
                  { label: "Role", value: log.actorRole || log.actor?.role || "-" },
                  { label: "Time", value: formatDateTime(log.createdAt) },
                  { label: "Note", value: log.note || "-" }
                ]}
                onClick={() => setSelectedLog(log)}
                onActionClick={() => setSelectedLog(log)}
                actionLabel="View Details"
              />
            ))}
          </div>}
          </>
        ) : (
          <div className="activity-empty">
            No activity records found for the selected filters.
          </div>
        )}
      </section>

      {selectedLog && (
        <div className="activity-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="activity-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="activity-modal-head">
              <div>
                <h3>{actionLabels[selectedLog.action] || selectedLog.action}</h3>
                <p>
                  {selectedLog.entityType} #{selectedLog.entityId ?? "-"} - {formatDateTime(selectedLog.createdAt)}
                </p>
              </div>
              <button className="activity-modal-close" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>

            <div className="activity-modal-meta">
              <p><span>Time:</span> {formatDateTime(selectedLog.createdAt)}</p>
              <p><span>Action:</span> {actionLabels[selectedLog.action] || selectedLog.action}</p>
              <p><span>Module:</span> {selectedLog.entityType}</p>
              <p><span>Record ID:</span> {selectedLog.entityId ?? "-"}</p>
              <p><span>User:</span> {selectedLog.actorName || selectedLog.actor?.name || "System"}</p>
              <p><span>Role:</span> {selectedLog.actorRole || selectedLog.actor?.role || "-"}</p>
              <p><span>Note:</span> {selectedLog.note || "-"}</p>
            </div>

            <div className="activity-json-grid">
              <div>
                <p>Old Value</p>
                <pre>{prettyValue(sanitizeAuditValue(selectedLog.oldValue, selectedLog.entityType))}</pre>
              </div>
              <div>
                <p>New Value</p>
                <pre>{prettyValue(sanitizeAuditValue(selectedLog.newValue, selectedLog.entityType))}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityLogPage;
