import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import MobileListCard from "../components/common/MobileListCard";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { useIsMobile } from "../hooks/useIsMobile";
import { exportRowsToExcel } from "../utils/exportExcel";
import PurchaseOrderFormPage from "./PurchaseOrderFormPage";

const PAGE_SIZE = 10;

const PO_STATUS_OPTIONS = [
  { value: "all",                label: "All Status" },
  { value: "DRAFT",              label: "Draft" },
  { value: "SENT_TO_SUPPLIER",   label: "Sent to Supplier" },
  { value: "PARTIALLY_RECEIVED", label: "Partially Received" },
  { value: "FULLY_RECEIVED",     label: "Fully Received" },
  { value: "CLOSED",             label: "Closed" }
];

const STATUS_STYLE = {
  DRAFT:              { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" },
  SENT_TO_SUPPLIER:   { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  PARTIALLY_RECEIVED: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" },
  FULLY_RECEIVED:     { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" },
  CLOSED:             { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }
};

const STATUS_LABEL = {
  DRAFT:              "Draft",
  SENT_TO_SUPPLIER:   "Sent to Supplier",
  PARTIALLY_RECEIVED: "Partially Received",
  FULLY_RECEIVED:     "Fully Received",
  CLOSED:             "Closed"
};

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatAmount(val) {
  if (val == null || val === "") return "-";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(val);
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
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const tableWrapRef = useRef(null);

  const [showNewModal, setShowNewModal]  = useState(false);
  const [loading, setLoading]           = useState(true);
  const [pos, setPos]                   = useState([]);
  const [searchText, setSearchText]     = useState("");
  const [query, setQuery]               = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFilter, setDateFilter]     = useState("");
  const isMobile = useIsMobile();
  useEffect(() => { if (isMobile) { setDateFilter(""); } }, [isMobile]);
  const [sortConfig, setSortConfig]     = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/purchase-orders", {
        params: {
          q:          query || undefined,
          status:     statusFilter === "all" ? undefined : statusFilter,
          supplier:   supplierFilter || undefined,
          date_from:  dateFilter || undefined,
          page:       currentPage,
          limit:      PAGE_SIZE
        }
      });
      const payload    = res.data;
      const items      = Array.isArray(payload?.items) ? payload.items : [];
      const pagination = payload?.pagination || null;
      setPos(items);
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRecords(Number(pagination?.total || items.length));
    } catch (error) {
      logApiError(error, "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [query, statusFilter, supplierFilter, dateFilter, currentPage]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const exportToExcel = async () => {
    let rows = sortedPos;
    try {
      const res = await api.get("/purchase-orders", {
        params: {
          q:         query || undefined,
          status:    statusFilter === "all" ? undefined : statusFilter,
          supplier:  supplierFilter || undefined,
          date_from: dateFilter || undefined,
          limit:     1000
        }
      });
      rows = Array.isArray(res.data?.items) ? res.data.items : sortedPos;
    } catch {
      // fall back to current page
    }
    exportRowsToExcel(
      `purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "poNumber",              header: "PO Number" },
        { key: "supplier",              header: "Supplier" },
        { key: "orderDate",             header: "Order Date" },
        { key: "expectedDeliveryDate",  header: "Expected Delivery" },
        { key: "category",              header: "Category" },
        { key: "itemCount",             header: "No. of Items" },
        { key: "totalAmount",           header: "Total Amount (INR)" },
        { key: "status",                header: "Status" },
        { key: "notes",                 header: "Notes" }
      ],
      rows.map((po) => ({
        poNumber:             po.poNumber || "-",
        supplier:             po.supplier?.name || "-",
        orderDate:            formatDate(po.orderDate),
        expectedDeliveryDate: formatDate(po.expectedDeliveryDate),
        category:             po.category || "-",
        itemCount:            po._count?.items ?? "-",
        totalAmount:          po.totalAmount ?? 0,
        status:               STATUS_LABEL[po.status] || po.status || "-",
        notes:                po.notes || ""
      }))
    );
  };

  const sortedPos = useMemo(() => {
    const sorted = [...pos];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      let va = "", vb = "";
      if (key === "createdAt")    { va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime(); }
      else if (key === "poNumber")     { va = String(a.poNumber || "").toLowerCase(); vb = String(b.poNumber || "").toLowerCase(); }
      else if (key === "supplier")     { va = String(a.supplier?.name || "").toLowerCase(); vb = String(b.supplier?.name || "").toLowerCase(); }
      else if (key === "totalAmount")  { va = Number(a.totalAmount || 0); vb = Number(b.totalAmount || 0); }
      else if (key === "status")       { va = String(a.status || "").toLowerCase(); vb = String(b.status || "").toLowerCase(); }
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
    return sorted;
  }, [pos, sortConfig]);

  const onSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
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
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Purchase Orders</h2>
        <div className="order-header-right">
          <div className="order-header-search">
            <SearchIcon />
            <input
              placeholder="Search PO number or supplier..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearchSubmit(); }}
            />
          </div>
          <button className="order-btn-secondary" onClick={exportToExcel}>
            Export to Excel
          </button>
          <button className="order-btn-primary" onClick={() => setShowNewModal(true)}>
            + New PO
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="order-card" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input"
            style={{ minWidth: 160, maxWidth: 200 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            {PO_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            className="input"
            style={{ minWidth: 160, maxWidth: 220 }}
            type="text"
            placeholder="Filter by supplier"
            value={supplierFilter}
            onChange={(e) => { setSupplierFilter(e.target.value); setCurrentPage(1); }}
          />
          {!isMobile && (
            <input
              className="input"
              style={{ minWidth: 140, maxWidth: 180 }}
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
            />
          )}
          {(query || statusFilter !== "all" || supplierFilter || dateFilter) && (
            <button
              className="order-btn-secondary"
              onClick={() => { setQuery(""); setSearchText(""); setStatusFilter("all"); setSupplierFilter(""); setDateFilter(""); setCurrentPage(1); }}
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
        ) : sortedPos.length ? (
          <>
            {!isMobile && <div className="order-table-wrap" ref={tableWrapRef}>
              <table className="order-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th><SortBtn colKey="poNumber" label="PO Number" /></th>
                    <th><SortBtn colKey="supplier" label="Supplier" /></th>
                    <th><SortBtn colKey="createdAt" label="Order Date" /></th>
                    <th>Exp. Delivery</th>
                    <th style={{ textAlign: "center" }}>Items</th>
                    <th><SortBtn colKey="totalAmount" label="Amount" /></th>
                    <th><SortBtn colKey="status" label="Status" /></th>
                  </tr>
                </thead>
                <VirtualizedTableBody
                  rows={sortedPos}
                  colSpan={8}
                  rowHeight={52}
                  overscan={8}
                  scrollContainerRef={tableWrapRef}
                  getRowKey={(po) => po.id}
                  renderRow={(po, index) => (
                    <tr
                      key={po.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    >
                      <td style={{ color: "#94a3b8", fontSize: 12 }}>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{po.poNumber}</td>
                      <td>{po.supplier?.name || "-"}</td>
                      <td>{formatDate(po.orderDate)}</td>
                      <td>{formatDate(po.expectedDeliveryDate)}</td>
                      <td style={{ textAlign: "center" }}>{po._count?.items ?? "-"}</td>
                      <td style={{ fontWeight: 600 }}>{formatAmount(po.totalAmount)}</td>
                      <td><StatusBadge status={po.status} /></td>
                    </tr>
                  )}
                />
              </table>
            </div>}
            <div className="order-pagination" style={{ borderTop: "1px solid #f1f5f9" }}>
              <div className="order-pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              <div className="order-page-controls">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>

            {isMobile && <div className="order-mobile-list" style={{ padding: "0 20px 20px" }}>
              {sortedPos.map((po) => (
                <MobileListCard
                  key={po.id}
                  title={po.poNumber}
                  subtitle={po.supplier?.name || "-"}
                  badge={STATUS_LABEL[po.status] || po.status}
                  badgeColor={po.status === "FULLY_RECEIVED" ? "green" : po.status === "SENT_TO_SUPPLIER" ? "blue" : po.status === "PARTIALLY_RECEIVED" ? "orange" : "default"}
                  fields={[
                    { label: "Order Date", value: formatDate(po.orderDate) },
                    { label: "Exp. Delivery", value: formatDate(po.expectedDeliveryDate) },
                    { label: "Items", value: po._count?.items ?? "-" },
                    { label: "Amount", value: formatAmount(po.totalAmount) }
                  ]}
                  onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  onActionClick={() => navigate(`/purchase-orders/${po.id}`)}
                  actionLabel="View Details"
                />
              ))}
              <div className="order-pagination" style={{ borderTop: "none", paddingTop: 16, marginTop: 0 }}>
                <div className="order-pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
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
            <p>No purchase orders found</p>
            <button className="order-btn-primary" onClick={() => setShowNewModal(true)}>
              Create Purchase Order
            </button>
          </div>
        )}
      </section>

      {showNewModal && (
        <PurchaseOrderFormPage
          isModal
          onClose={() => setShowNewModal(false)}
          onSuccess={(id) => { setShowNewModal(false); navigate(`/purchase-orders/${id}`); }}
        />
      )}
    </div>
  );
}

export default PurchaseOrderListPage;
