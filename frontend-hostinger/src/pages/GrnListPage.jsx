import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import MobileListCard from "../components/common/MobileListCard";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { useIsMobile } from "../hooks/useIsMobile";
import SearchableSelect from "../components/common/SearchableSelect";
import MonthFilter from "../components/common/MonthFilter";
import { exportRowsToExcel } from "../utils/exportExcel";
import StatusBadge from "../components/common/StatusBadge";
import { GRN_STATUS_CONFIG } from "../config/statusConfig";

const PAGE_SIZE = 10;

const GRN_STATUS_OPTIONS = [
  { value: "all",       label: "All Status" },
  { value: "DRAFT",     label: "Draft"      },
  { value: "CONFIRMED", label: "Confirmed"  }
];

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function GrnListPage() {
  const navigate = useNavigate();
  const tableWrapRef = useRef(null);

  const [loading, setLoading]           = useState(true);
  const [grns, setGrns]                 = useState([]);
  const [searchText, setSearchText]     = useState("");
  const [query, setQuery]               = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter]   = useState("");
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
          month:  monthFilter || undefined,
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

  useEffect(() => { fetchData(); }, [query, statusFilter, monthFilter, currentPage]);
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

  const exportToExcel = () => {
    const columns = [
      { key: "grnNumber",     header: "GRN Number" },
      { key: "poNumber",      header: "PO Number" },
      { key: "supplier",      header: "Supplier" },
      { key: "receivedDate",  header: "Received Date" },
      { key: "receivedBy",    header: "Received By" },
      { key: "warehouse",     header: "Warehouse" },
      { key: "items",         header: "Items" },
      { key: "status",        header: "Status" }
    ];
    const rows = sortedGrns.map((grn) => ({
      grnNumber:    grn.grnNumber || "-",
      poNumber:     grn.purchaseOrder?.poNumber || "-",
      supplier:     grn.purchaseOrder?.supplier?.name || "-",
      receivedDate: formatDate(grn.receivedDate),
      receivedBy:   grn.receivedBy || "-",
      warehouse:    grn.warehouseLocation || "-",
      items:        grn._count?.items ?? "-",
      status:       grn.status || "-"
    }));
    exportRowsToExcel("goods-receipt-notes", columns, rows);
  };

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
      {/* HEADER */}
      <section className="order-card">
        <div className="order-header-card">
          <div className="order-header-left">
            <h2>Goods Receipt Notes</h2>
          </div>
          <div className="order-header-right">
            <button className="order-btn-primary" onClick={() => navigate("/grns/new")}>
              + New GRN
            </button>
          </div>
        </div>
      </section>

      {/* SEARCH + FILTERS + ACTIONS */}
      <section className="order-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input autoComplete="off"
            placeholder="Search GRN or PO number..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSearchSubmit(); }}
          />
        </div>

        <div className="unified-filter-row">
          <SearchableSelect
            options={GRN_STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
            placeholder="All Status"
          />
          <MonthFilter
            title="Filter by month the goods were received"
            value={monthFilter}
            onChange={(month) => { setMonthFilter(month); setCurrentPage(1); }}
          />
          {(query || statusFilter !== "all" || monthFilter) && (
            <button
              className="order-btn-secondary"
              onClick={() => { setQuery(""); setSearchText(""); setStatusFilter("all"); setMonthFilter(""); setCurrentPage(1); }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="unified-actions" style={{ justifyContent: "space-between" }}>
          <div className="unified-actions">
            <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
            <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
          </div>
          <span style={{ fontSize: 13, color: "#64748b" }}>
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
                      <td><StatusBadge status={grn.status} config={GRN_STATUS_CONFIG} /></td>
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
