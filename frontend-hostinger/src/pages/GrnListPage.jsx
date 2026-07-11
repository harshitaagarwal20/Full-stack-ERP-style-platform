import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import MobileListCard from "../components/common/MobileListCard";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { useIsMobile } from "../hooks/useIsMobile";

const PAGE_SIZE = 10;

const GRN_STATUS_OPTIONS = [
  { value: "all",       label: "All Status" },
  { value: "DRAFT",     label: "Draft"      },
  { value: "CONFIRMED", label: "Confirmed"  }
];

const STATUS_STYLE = {
  DRAFT:     { background: "#fefce8", color: "#854d0e", border: "1px solid #fde68a" },
  CONFIRMED: { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }
};

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <span style={{
      ...s,
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: "nowrap",
      display: "inline-block"
    }}>
      {status === "CONFIRMED" ? "Confirmed" : "Draft"}
    </span>
  );
}

function GrnListPage() {
  const navigate = useNavigate();
  const tableWrapRef = useRef(null);

  const [loading, setLoading]           = useState(true);
  const [grns, setGrns]                 = useState([]);
  const [searchText, setSearchText]     = useState("");
  const [query, setQuery]               = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isMobile = useIsMobile();
  const [sortConfig, setSortConfig]     = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/grns", {
        params: {
          q:      query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          page:   currentPage,
          limit:  PAGE_SIZE
        }
      });
      const payload    = res.data;
      const items      = Array.isArray(payload?.items) ? payload.items : [];
      const pagination = payload?.pagination || null;
      setGrns(items);
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRecords(Number(pagination?.total || items.length));
    } catch (error) {
      logApiError(error, "Failed to load GRNs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [query, statusFilter, currentPage]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const sortedGrns = useMemo(() => {
    const sorted = [...grns];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      let va = "", vb = "";
      if (key === "createdAt")      { va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime(); }
      else if (key === "grnNumber") { va = String(a.grnNumber || "").toLowerCase(); vb = String(b.grnNumber || "").toLowerCase(); }
      else if (key === "status")    { va = String(a.status || "").toLowerCase(); vb = String(b.status || "").toLowerCase(); }
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
    return sorted;
  }, [grns, sortConfig]);

  const onSort = (key) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const onSearchSubmit = () => { setQuery(searchText.trim()); setCurrentPage(1); };

  const SortBtn = ({ colKey, label }) => (
    <button className="order-sort-btn" onClick={() => onSort(colKey)}>
      {label}
      {sortConfig.key === colKey && (
        <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
      )}
    </button>
  );

  return (
    <div className="order-page">
      {/* Header */}
      <section className="order-card order-header-card">
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Goods Receipt Notes</h2>
        <div className="order-header-right">
          <div className="order-header-search">
            <SearchIcon />
            <input
              placeholder="Search GRN or PO number..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearchSubmit(); }}
            />
          </div>
          <button className="order-btn-primary" onClick={() => navigate("/grns/new")}>
            + New GRN
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="order-card" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input"
            style={{ minWidth: 150, maxWidth: 200 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            {GRN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(query || statusFilter !== "all") && (
            <button
              className="order-btn-secondary"
              onClick={() => { setQuery(""); setSearchText(""); setStatusFilter("all"); setCurrentPage(1); }}
            >
              Clear
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
            {totalRecords} record{totalRecords !== 1 ? "s" : ""}
          </span>
        </div>
      </section>

      {/* Table */}
      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => <div key={i} className="order-skeleton-row" />)}
          </div>
        ) : sortedGrns.length ? (
          <>
            {!isMobile && <div className="order-table-wrap" ref={tableWrapRef}>
              <table className="order-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th><SortBtn colKey="grnNumber" label="GRN Number" /></th>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Received Date</th>
                    <th>Received By</th>
                    <th>Warehouse</th>
                    <th style={{ textAlign: "center" }}>Items</th>
                    <th><SortBtn colKey="status" label="Status" /></th>
                  </tr>
                </thead>
                <VirtualizedTableBody
                  rows={sortedGrns}
                  colSpan={9}
                  rowHeight={52}
                  overscan={8}
                  scrollContainerRef={tableWrapRef}
                  getRowKey={(grn) => grn.id}
                  renderRow={(grn, index) => (
                    <tr
                      key={grn.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/grns/${grn.id}`)}
                    >
                      <td style={{ color: "#94a3b8", fontSize: 12 }}>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{grn.grnNumber}</td>
                      <td style={{ color: "#0f172a" }}>{grn.purchaseOrder?.poNumber || "-"}</td>
                      <td>{grn.purchaseOrder?.supplier?.name || "-"}</td>
                      <td>{formatDate(grn.receivedDate)}</td>
                      <td>{grn.receivedBy || "-"}</td>
                      <td>{grn.warehouseLocation || "-"}</td>
                      <td style={{ textAlign: "center" }}>{grn._count?.items ?? "-"}</td>
                      <td><StatusBadge status={grn.status} /></td>
                    </tr>
                  )}
                />
              </table>
            </div>}
            <div className="order-pagination" style={{ borderTop: "1px solid #f1f5f9" }}>
              <div className="order-pagination-info">Page {currentPage} of {totalPages}</div>
              <div className="order-page-controls">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>

            {isMobile && <div className="order-mobile-list" style={{ padding: "0 20px 20px" }}>
              {sortedGrns.map((grn) => (
                <MobileListCard
                  key={grn.id}
                  title={grn.grnNumber}
                  subtitle={grn.purchaseOrder?.supplier?.name || "-"}
                  badge={grn.status === "CONFIRMED" ? "Confirmed" : "Draft"}
                  badgeColor={grn.status === "CONFIRMED" ? "green" : "default"}
                  fields={[
                    { label: "PO Number", value: grn.purchaseOrder?.poNumber || "-" },
                    { label: "Received Date", value: formatDate(grn.receivedDate) },
                    { label: "Items", value: grn._count?.items ?? "-" },
                    { label: "Warehouse", value: grn.warehouseLocation || "-" }
                  ]}
                  onClick={() => navigate(`/grns/${grn.id}`)}
                  onActionClick={() => navigate(`/grns/${grn.id}`)}
                  actionLabel="View Details"
                />
              ))}
              <div className="order-pagination" style={{ borderTop: "none", paddingTop: 16, marginTop: 0 }}>
                <div className="order-pagination-info">Page {currentPage} of {totalPages}</div>
                <div className="order-page-controls">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </div>
            </div>}
          </>
        ) : (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>No goods receipt notes found</p>
            <button className="order-btn-primary" onClick={() => navigate("/grns/new")}>
              Create GRN
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default GrnListPage;
