import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import Toolbar from "../components/common/Toolbar";
import SearchableSelect from "../components/common/SearchableSelect";
import { exportRowsToExcel } from "../utils/exportExcel";
import { useIsMobile } from "../hooks/useIsMobile";
import { pickMobileRecent } from "../utils/mobileRecent";
import MobileListCard from "../components/common/MobileListCard";

function qcBadgeLabel(status) {
  if (status === "PASS") return "Passed";
  if (status === "FAIL") return "Failed";
  if (status === "PENDING") return "In Review";
  return "Pending QC";
}

function qcBadgeColor(status) {
  if (status === "PASS") return "green";
  if (status === "FAIL") return "orange";
  if (status === "PENDING") return "blue";
  return "default";
}

const QC_FILTER_OPTIONS = [
  { value: "NOT_STARTED", label: "Pending QC" },
  { value: "PENDING", label: "In Review" },
  { value: "PASS", label: "Passed" },
  { value: "FAIL", label: "Failed" }
];

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function qcStatusOf(record) {
  return record.finishedGoodsTestSheet?.overallResult || "NOT_STARTED";
}

function QcStatusBadge({ status }) {
  if (status === "PASS") return <span className="order-status dispatched">Passed</span>;
  if (status === "FAIL") return <span className="order-status" style={{ background: "#fee2e2", color: "#b91c1c" }}>Failed</span>;
  if (status === "PENDING") return <span className="order-status in-production">In Review</span>;
  return <span className="order-status created">Pending QC</span>;
}

function QualityCheckPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [qcFilter, setQcFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/production", { params: { q: search || undefined } });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      // Only batches with at least a partial produced quantity are eligible
      // for QC — mirrors the same gate the backend enforces when saving a
      // finished-goods test sheet.
      const eligible = items.filter((r) => r.status === "COMPLETED" || r.status === "PARTIALLY_PRODUCED");
      setRecords(eligible);
    } catch (err) {
      logApiError(err, "Failed to load quality check queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    if (!qcFilter) return records;
    return records.filter((r) => qcStatusOf(r) === qcFilter);
  }, [records, qcFilter]);

  const onSearchSubmit = () => setSearch(searchText.trim());

  // Mobile only: default to the 5 most recent, but show all matches while
  // searching. Desktop returns the full list unchanged.
  const isMobile = useIsMobile();
  const displayRecords = useMemo(
    () => pickMobileRecent(filtered, { isMobile, hasSearch: Boolean(search) }),
    [filtered, isMobile, search]
  );
  const showingRecentOnly = isMobile && !search && filtered.length > displayRecords.length;

  const exportToExcel = () => {
    const columns = [
      { key: "batchNo",     header: "Batch No." },
      { key: "product",     header: "Product" },
      { key: "grade",       header: "Grade" },
      { key: "client",      header: "Client" },
      { key: "produced",    header: "Produced Qty" },
      { key: "completedOn", header: "Completed On" },
      { key: "qcStatus",    header: "QC Status" },
      { key: "approvedBy",  header: "Approved By" }
    ];
    const rows = filtered.map((record) => ({
      batchNo:     record.batchNo || "-",
      product:     record.order?.product || "-",
      grade:       record.order?.grade || "-",
      client:      record.order?.clientName || "-",
      produced:    Number(record.producedQuantity || 0),
      completedOn: formatDate(record.productionCompletionDate),
      qcStatus:    qcStatusOf(record),
      approvedBy:  record.finishedGoodsTestSheet?.approvedBy || "-"
    }));
    exportRowsToExcel("quality-check", columns, rows);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchText("");
    setQcFilter("");
  };

  const activeFilterCount = [search, qcFilter].filter(Boolean).length;

  return (
    <div className="order-page">
      <Toolbar
        title="Quality Check"
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
              options={QC_FILTER_OPTIONS}
              value={qcFilter}
              onChange={(value) => setQcFilter(value)}
              placeholder="All QC Status"
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
        ) : filtered.length === 0 ? (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>No batches waiting on quality check</p>
            <p style={{ color: "#64748b", marginTop: 6 }}>Batches appear here once production reaches Completed or Partially Produced.</p>
          </div>
        ) : (
          <div className="order-table-wrap">
            <div className="order-table-meta">
              {filtered.length} batch{filtered.length !== 1 ? "es" : ""}
            </div>
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Batch No.</th>
                  <th>Product</th>
                  <th>Grade</th>
                  <th>Client</th>
                  <th style={{ textAlign: "right" }}>Produced Qty</th>
                  <th>Completed On</th>
                  <th>QC Status</th>
                  <th>Approved By</th>
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
                    <td style={{ textAlign: "right" }}>{Number(record.producedQuantity || 0).toLocaleString()}</td>
                    <td>{formatDate(record.productionCompletionDate)}</td>
                    <td><QcStatusBadge status={qcStatusOf(record)} /></td>
                    <td>{record.finishedGoodsTestSheet?.approvedBy || "-"}</td>
                    <td>
                      <button
                        className="order-sort-btn"
                        onClick={() => navigate(`/production/${record.id}/qc-test-sheet`)}
                      >
                        Open QC Test Sheet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isMobile && !loading && filtered.length > 0 && (
          <div className="order-mobile-list">
            {displayRecords.map((record) => (
              <MobileListCard
                key={record.id}
                title={record.batchNo || "—"}
                subtitle={record.order?.product || "-"}
                badge={qcBadgeLabel(qcStatusOf(record))}
                badgeColor={qcBadgeColor(qcStatusOf(record))}
                fields={[
                  { label: "Client", value: record.order?.clientName || "-" },
                  { label: "Grade", value: record.order?.grade || "-" },
                  { label: "Produced Qty", value: Number(record.producedQuantity || 0).toLocaleString() },
                  { label: "Completed On", value: formatDate(record.productionCompletionDate) }
                ]}
                onActionClick={() => navigate(`/production/${record.id}/qc-test-sheet`)}
                actionLabel="Open QC Test Sheet"
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

export default QualityCheckPage;
