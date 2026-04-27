import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { ClipboardIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";

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
  const [selectedLog, setSelectedLog] = useState(null);
  const tableWrapRef = useRef(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/audit-logs");
      setLogs(data || []);
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
        <button className="activity-refresh-btn" onClick={fetchLogs}>Refresh</button>
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
            <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              {actionOptions.map((option) => (
                <option key={option} value={option}>{option === "ALL" ? "All Actions" : actionLabels[option] || option}</option>
              ))}
            </select>
            <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
              {entityOptions.map((option) => (
                <option key={option} value={option}>{option === "ALL" ? "All Modules" : option}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="activity-empty">Loading activity log...</div>
        ) : filteredLogs.length ? (
          <div className="activity-table-wrap" ref={tableWrapRef}>
            <div className="activity-table-meta">
              Showing {filteredLogs.length} activity record{filteredLogs.length === 1 ? "" : "s"}
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
          </div>
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
                <pre>{prettyValue(selectedLog.oldValue)}</pre>
              </div>
              <div>
                <p>New Value</p>
                <pre>{prettyValue(selectedLog.newValue)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityLogPage;
