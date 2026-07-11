import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { formatDate, getStatusClass, getStatusLabel, parseMfgData } from "../utils/productionMfg";
import Toolbar from "../components/common/Toolbar";
import SearchableSelect from "../components/common/SearchableSelect";
import useMasterData from "../hooks/useMasterData";

function OperationLogListPage() {
  const navigate = useNavigate();
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/production", {
        params: { q: search || undefined, status: statusFilter || undefined }
      });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setRecords(items);
    } catch (err) {
      logApiError(err, "Failed to load operation log queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const onSearchSubmit = () => setSearch(searchText.trim());

  const clearFilters = () => {
    setSearch("");
    setSearchText("");
    setStatusFilter("");
  };

  const activeFilterCount = [search, statusFilter].filter(Boolean).length;

  const statusOptions = useMemo(
    () => (Array.isArray(masterData.productionStatuses) ? masterData.productionStatuses : []),
    [masterData.productionStatuses]
  );

  return (
    <div className="order-page">
      <Toolbar
        title="Operation Log"
        search={
          <div className="ui-toolbar-search">
            <SearchIcon />
            <input
              placeholder="Search batch, client or product..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearchSubmit();
              }}
            />
          </div>
        }
        actions={
          <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
        }
        filters={
          <>
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              placeholder="All Statuses"
            />
            {activeFilterCount > 0 && (
              <button className="order-btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </>
        }
      />

      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="order-skeleton-row" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>No production batches found</p>
          </div>
        ) : (
          <div className="order-table-wrap">
            <div className="order-table-meta">
              {records.length} batch{records.length !== 1 ? "es" : ""}
            </div>
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Batch No.</th>
                  <th>Product</th>
                  <th>Grade</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Lots Logged</th>
                  <th>Last Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => {
                  const mfg = parseMfgData(record.rawMaterials);
                  return (
                    <tr key={record.id}>
                      <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{record.batchNo || "-"}</td>
                      <td>{record.order?.product || "-"}</td>
                      <td>{record.order?.grade || "-"}</td>
                      <td>{record.order?.clientName || "-"}</td>
                      <td><span className={`order-status ${getStatusClass(record.status)}`}>{getStatusLabel(record.status)}</span></td>
                      <td style={{ textAlign: "right" }}>{mfg.batchLogs.length}</td>
                      <td>{formatDate(record.updatedAt)}</td>
                      <td>
                        <button
                          className="order-sort-btn"
                          onClick={() => navigate(`/production/${record.id}/operation-log`)}
                        >
                          Open Operation Log
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default OperationLogListPage;
