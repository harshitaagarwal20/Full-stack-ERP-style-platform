import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { formatDate, getStatusClass, getStatusLabel } from "../utils/productionMfg";
import Toolbar from "../components/common/Toolbar";
import SearchableSelect from "../components/common/SearchableSelect";
import useMasterData from "../hooks/useMasterData";
import { exportRowsToExcel } from "../utils/exportExcel";
import { useIsMobile } from "../hooks/useIsMobile";
import { pickMobileRecent } from "../utils/mobileRecent";
import MobileListCard from "../components/common/MobileListCard";

function statusBadgeColor(status) {
  if (status === "COMPLETED") return "green";
  if (status === "IN_PROGRESS" || status === "PARTIALLY_PRODUCED") return "blue";
  if (status === "HOLD") return "orange";
  return "default";
}

function InProcessTestingListPage() {
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
      logApiError(err, "Failed to load in-process testing queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const onSearchSubmit = () => setSearch(searchText.trim());

  // Mobile only: default to the 5 most recent, but show all matches while
  // searching. Desktop returns the full list unchanged.
  const isMobile = useIsMobile();
  const displayRecords = useMemo(
    () => pickMobileRecent(records, { isMobile, hasSearch: Boolean(search) }),
    [records, isMobile, search]
  );
  const showingRecentOnly = isMobile && !search && records.length > displayRecords.length;

  const exportToExcel = () => {
    const columns = [
      { key: "batchNo",     header: "Batch No." },
      { key: "product",     header: "Product" },
      { key: "grade",       header: "Grade" },
      { key: "client",      header: "Client" },
      { key: "status",      header: "Status" },
      { key: "tests",       header: "Tests Recorded" },
      { key: "lastUpdated", header: "Last Updated" }
    ];
    const rows = records.map((record) => ({
      batchNo:     record.batchNo || "-",
      product:     record.order?.product || "-",
      grade:       record.order?.grade || "-",
      client:      record.order?.clientName || "-",
      status:      getStatusLabel(record.status),
      tests:       record.inProcessTestSheet?._count?.items || 0,
      lastUpdated: formatDate(record.inProcessTestSheet?.updatedAt)
    }));
    exportRowsToExcel("in-process-testing", columns, rows);
  };

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
        title="In-Process Testing"
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
          <>
            <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
            <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
          </>
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
                  <th style={{ textAlign: "right" }}>Entries Logged</th>
                  <th>Last Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((record, idx) => (
                  <tr key={record.id}>
                    <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{record.batchNo || "-"}</td>
                    <td>{record.order?.product || "-"}</td>
                    <td>{record.order?.grade || "-"}</td>
                    <td>{record.order?.clientName || "-"}</td>
                    <td><span className={`order-status ${getStatusClass(record.status)}`}>{getStatusLabel(record.status)}</span></td>
                    <td style={{ textAlign: "right" }}>{record.inProcessTestSheet?._count?.items || 0}</td>
                    <td>{formatDate(record.inProcessTestSheet?.updatedAt)}</td>
                    <td>
                      <button
                        className="order-sort-btn"
                        onClick={() => navigate(`/production/${record.id}/in-process-testing`)}
                      >
                        Open In-Process Test Sheet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isMobile && !loading && records.length > 0 && (
          <div className="order-mobile-list">
            {displayRecords.map((record) => (
              <MobileListCard
                key={record.id}
                title={record.batchNo || "—"}
                subtitle={record.order?.product || "-"}
                badge={getStatusLabel(record.status)}
                badgeColor={statusBadgeColor(record.status)}
                fields={[
                  { label: "Client", value: record.order?.clientName || "-" },
                  { label: "Grade", value: record.order?.grade || "-" },
                  { label: "Entries Logged", value: record.inProcessTestSheet?._count?.items || 0 },
                  { label: "Last Updated", value: formatDate(record.inProcessTestSheet?.updatedAt) }
                ]}
                onActionClick={() => navigate(`/production/${record.id}/in-process-testing`)}
                actionLabel="Open In-Process Test Sheet"
              />
            ))}
            {showingRecentOnly && (
              <div className="mobile-recent-hint">
                Showing the 5 most recent. Search to find any batch.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default InProcessTestingListPage;
