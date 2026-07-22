import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, CheckIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import useMasterData from "../hooks/useMasterData";
import { exportRowsToExcel } from "../utils/exportExcel";
import { useIsMobile } from "../hooks/useIsMobile";
import { pickMobileRecent } from "../utils/mobileRecent";
import MobileListCard from "../components/common/MobileListCard";

const emptyPackForm = { order_id: null, packed_quantity: "", packing_material_item_id: "", packing_material_qty: "", packed_by: "", remarks: "" };

// The old page split the same order list across "Queue" and "New Packing" tabs.
// The status filter covers both: "pending" is the queue, "all" is every order.
const STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "not_started", label: "Not started" },
  { value: "partial", label: "Partially packed" },
  { value: "packed", label: "Fully packed" },
  { value: "all", label: "All orders" }
];

const packStatusOf = (order) => {
  if (Number(order.remainingToPack) <= 0) return "packed";
  if (Number(order.packedQuantity) > 0) return "partial";
  return "not_started";
};

const STATUS_META = {
  not_started: { label: "Not started", className: "created", badgeColor: "default" },
  partial: { label: "Partially packed", className: "in-production", badgeColor: "orange" },
  packed: { label: "Fully packed", className: "dispatched", badgeColor: "green" }
};

const matchesStatusFilter = (order, filter) => {
  if (filter === "all") return true;
  const status = packStatusOf(order);
  if (filter === "pending") return status !== "packed";
  return status === filter;
};

const num = (value) => Number(value ?? 0) || 0;

function PackingPage() {
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [clientFilter, setClientFilter] = useState("");
  const [packForm, setPackForm] = useState(emptyPackForm);
  const [activeOrder, setActiveOrder] = useState(null);
  const [saving, setSaving] = useState(false);

  const packingMaterialOptions = useMemo(
    () => (Array.isArray(masterData.packingMaterialsCatalog) ? masterData.packingMaterialsCatalog : []),
    [masterData.packingMaterialsCatalog]
  );

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/packing", { params: { q: search || undefined } });
      setAllOrders(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      logApiError(err, "Failed to load packing queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onSearchSubmit = () => setSearch(searchText.trim());

  const resetFilters = () => {
    setSearchText("");
    setSearch("");
    setStatusFilter("pending");
    setClientFilter("");
  };

  const clientOptions = useMemo(() => {
    const names = [...new Set(allOrders.map((order) => order.clientName).filter(Boolean))].sort();
    return [{ value: "", label: "All clients" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [allOrders]);

  const orders = useMemo(
    () =>
      allOrders.filter(
        (order) => matchesStatusFilter(order, statusFilter) && (!clientFilter || order.clientName === clientFilter)
      ),
    [allOrders, statusFilter, clientFilter]
  );

  // Mobile only: default to the 5 most recent, but show all matches while
  // searching. Desktop returns the full list unchanged.
  const isMobile = useIsMobile();
  const displayOrders = useMemo(
    () => pickMobileRecent(orders, { isMobile, hasSearch: Boolean(search) }),
    [orders, isMobile, search]
  );
  const showingRecentOnly = isMobile && !search && orders.length > displayOrders.length;

  const exportToExcel = () => {
    const columns = [
      { key: "orderNo",             header: "Order No" },
      { key: "product",             header: "Product" },
      { key: "client",              header: "Client" },
      { key: "quantity",            header: "Order Qty" },
      { key: "unit",                header: "Unit" },
      { key: "packedQuantity",      header: "Packed Qty" },
      { key: "remainingToPack",     header: "Remaining to Pack" },
      { key: "remainingToDispatch", header: "Remaining to Dispatch" },
      { key: "packingStatus",       header: "Packing Status" }
    ];
    const rows = orders.map((order) => ({
      orderNo:             order.orderNo || "-",
      product:             order.product || "-",
      client:              order.clientName || "-",
      quantity:            order.quantity ?? "-",
      unit:                order.unit || "-",
      packedQuantity:      order.packedQuantity ?? 0,
      remainingToPack:     order.remainingToPack ?? 0,
      remainingToDispatch: order.remainingToDispatch ?? 0,
      packingStatus:       STATUS_META[packStatusOf(order)].label
    }));
    exportRowsToExcel("packing", columns, rows);
  };

  const openPackModal = (order) => {
    setActiveOrder(order);
    setPackForm({ ...emptyPackForm, order_id: order.id, packed_quantity: String(order.remainingToPack) });
  };

  const closePackModal = () => {
    if (saving) return;
    setActiveOrder(null);
    setPackForm(emptyPackForm);
  };

  const packedNow = num(packForm.packed_quantity);
  const remainingToPack = num(activeOrder?.remainingToPack);
  const remainingAfterPack = Math.max(remainingToPack - packedNow, 0);
  const quantityError =
    packedNow > remainingToPack ? `Cannot pack more than the ${remainingToPack} ${activeOrder?.unit || ""} remaining.` : "";

  const submitPack = async (e) => {
    e.preventDefault();
    if (saving || quantityError) return;
    setSaving(true);
    try {
      await api.post("/packing", {
        order_id: packForm.order_id,
        packed_quantity: Number(packForm.packed_quantity),
        packing_material_item_id: packForm.packing_material_item_id.trim(),
        packing_material_qty: Number(packForm.packing_material_qty),
        packed_by: packForm.packed_by || undefined,
        remarks: packForm.remarks || undefined
      });
      dispatchUserMessage("Packing recorded — packing material deducted from inventory.", { title: "Packed", variant: "success" });
      closePackModal();
      fetchQueue();
    } catch (err) {
      logApiError(err, "Failed to record packing");
    } finally {
      setSaving(false);
    }
  };

  const renderProgress = (order) => {
    const quantity = num(order.quantity);
    const packed = num(order.packedQuantity);
    const percent = quantity > 0 ? Math.min(Math.round((packed / quantity) * 100), 100) : 0;
    return (
      <div className="pack-progress">
        <div className="pack-progress-track">
          <div className={`pack-progress-fill ${percent >= 100 ? "complete" : ""}`} style={{ width: `${percent}%` }} />
        </div>
        <span className="pack-progress-label">
          {packed} / {quantity} {order.unit || ""} ({percent}%)
        </span>
      </div>
    );
  };

  return (
    <div className="order-page">
      {/* HEADER */}
      <section className="order-card">
        <div className="order-header-card">
          <div className="order-header-left">
            <h2>Packing</h2>
          </div>
          <div className="order-header-right">
            <span className="unified-badge">
              {allOrders.filter((order) => num(order.remainingToPack) > 0).length} pending
            </span>
          </div>
        </div>
      </section>

      {/* SEARCH + FILTERS + ACTIONS */}
      <section className="order-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input autoComplete="off"
            placeholder="Search order, client or product..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchSubmit();
            }}
          />
        </div>

        <div className="unified-filter-row">
          <SearchableSelect
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Packing status"
          />
          <SearchableSelect
            options={clientOptions}
            value={clientFilter}
            onChange={setClientFilter}
            placeholder="All clients"
          />
        </div>

        <div className="unified-actions">
          <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
          <button className="order-btn-secondary" onClick={resetFilters}>Reset</button>
          <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
        </div>
      </section>

      {/* LIST */}
      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="order-skeleton-row" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>{search || clientFilter || statusFilter !== "pending" ? "No orders match these filters" : "Nothing waiting to be packed"}</p>
            <p style={{ color: "#64748b", marginTop: 6 }}>Orders appear here once their finished goods clear QC.</p>
          </div>
        ) : (
          <>
            <div className="order-table-wrap">
              <div className="order-table-meta">
                {orders.length} order{orders.length !== 1 ? "s" : ""}
                {statusFilter === "pending" ? " ready to pack" : ""}
              </div>
              <table className="order-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Order No</th>
                    <th>Product</th>
                    <th>Client</th>
                    <th style={{ width: 200 }}>Packing Progress</th>
                    <th style={{ textAlign: "right" }}>Remaining</th>
                    <th style={{ textAlign: "right" }}>Ready to Dispatch</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayOrders.map((order, idx) => {
                    const status = packStatusOf(order);
                    return (
                      <tr key={order.id}>
                        <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#1d4ed8" }}>{order.orderNo || "-"}</div>
                          {order.salesOrderNumber && (
                            <div className="pack-cell-sub">{order.salesOrderNumber}</div>
                          )}
                        </td>
                        <td>
                          <div>{order.product || "-"}</div>
                          {order.grade && <div className="pack-cell-sub">{order.grade}</div>}
                        </td>
                        <td>{order.clientName || "-"}</td>
                        <td>{renderProgress(order)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{order.remainingToPack}</td>
                        <td style={{ textAlign: "right" }}>{order.remainingToDispatch}</td>
                        <td>
                          <span className={`order-status ${STATUS_META[status].className}`}>{STATUS_META[status].label}</span>
                        </td>
                        <td>
                          {status === "packed" ? (
                            <span className="pack-done-note"><CheckIcon /> Packed</span>
                          ) : (
                            <button className="order-btn-secondary" onClick={() => openPackModal(order)}>
                              Record Packing
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isMobile && (
              <div className="order-mobile-list">
                {displayOrders.map((order) => {
                  const status = packStatusOf(order);
                  return (
                    <MobileListCard
                      key={order.id}
                      title={order.orderNo || "—"}
                      subtitle={order.product || "-"}
                      badge={STATUS_META[status].label}
                      badgeColor={STATUS_META[status].badgeColor}
                      fields={[
                        { label: "Client", value: order.clientName || "-" },
                        { label: "Order Qty", value: `${order.quantity} ${order.unit || ""}`.trim() },
                        { label: "Packed", value: order.packedQuantity },
                        { label: "Remaining to Pack", value: order.remainingToPack },
                        { label: "Ready to Dispatch", value: order.remainingToDispatch }
                      ]}
                      onActionClick={status === "packed" ? undefined : () => openPackModal(order)}
                      actionLabel="Record Packing"
                    />
                  );
                })}
                {showingRecentOnly && (
                  <div className="mobile-recent-hint">
                    Showing the 5 most recent. Search to find any order.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {activeOrder && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card pack-modal" style={{ width: "min(560px, 100%)" }}>
            <div className="masterdata-modal-head">
              <div>
                <h3>Record Packing</h3>
                <p>{activeOrder.orderNo} — {activeOrder.product} for {activeOrder.clientName}</p>
              </div>
              <button className="masterdata-modal-close-btn" onClick={closePackModal} disabled={saving} type="button">
                ✕
              </button>
            </div>

            <div className="pack-chips">
              <div className="pack-chip">
                <span>Order Qty</span>
                <strong>{activeOrder.quantity} {activeOrder.unit}</strong>
              </div>
              <div className="pack-chip">
                <span>Already Packed</span>
                <strong>{activeOrder.packedQuantity}</strong>
              </div>
              <div className="pack-chip highlight">
                <span>Remaining</span>
                <strong>{activeOrder.remainingToPack} {activeOrder.unit}</strong>
              </div>
            </div>

            <form onSubmit={submitPack}>
              <div className="masterdata-form-grid">
                <div>
                  <div className="pack-label-row">
                    <label className="label">Quantity to Pack <span className="req">*</span></label>
                    <button
                      type="button"
                      className="pack-link-btn"
                      onClick={() => setPackForm((p) => ({ ...p, packed_quantity: String(activeOrder.remainingToPack) }))}
                    >
                      Pack all remaining
                    </button>
                  </div>
                  <input autoComplete="off"
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={activeOrder.remainingToPack}
                    value={packForm.packed_quantity}
                    onChange={(e) => setPackForm((p) => ({ ...p, packed_quantity: e.target.value }))}
                    required
                  />
                  {quantityError ? (
                    <small className="pack-error">{quantityError}</small>
                  ) : (
                    <small style={{ color: "#64748b" }}>
                      {remainingAfterPack} {activeOrder.unit} will remain after this entry.
                    </small>
                  )}
                </div>
                <div>
                  <label className="label">Packing Material <span className="req">*</span></label>
                  <SearchableSelect
                    options={packingMaterialOptions}
                    value={packForm.packing_material_item_id}
                    onChange={(value) => setPackForm((p) => ({ ...p, packing_material_item_id: value }))}
                    placeholder="Select packing material"
                    allowCustom
                  />
                  <small style={{ color: "#64748b" }}>Deducted from inventory on save.</small>
                </div>
                <div>
                  <label className="label">Packing Material Used <span className="req">*</span></label>
                  <input autoComplete="off"
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. number of bags"
                    value={packForm.packing_material_qty}
                    onChange={(e) => setPackForm((p) => ({ ...p, packing_material_qty: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Packed By</label>
                  <input autoComplete="off"
                    className="input"
                    value={packForm.packed_by}
                    onChange={(e) => setPackForm((p) => ({ ...p, packed_by: e.target.value }))}
                  />
                </div>
                <div className="full-row">
                  <label className="label">Remarks</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={packForm.remarks}
                    onChange={(e) => setPackForm((p) => ({ ...p, remarks: e.target.value }))}
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              {Array.isArray(activeOrder.packingRecords) && activeOrder.packingRecords.length > 0 && (
                <div className="pack-history">
                  <h4>Previous entries</h4>
                  <ul>
                    {activeOrder.packingRecords.map((record) => (
                      <li key={record.id}>
                        <span className="pack-history-qty">{record.packedQuantity} {activeOrder.unit}</span>
                        <span className="pack-history-meta">
                          {record.packingMaterialItemId || "—"}
                          {record.packedBy ? ` · ${record.packedBy}` : ""}
                          {record.createdAt ? ` · ${new Date(record.createdAt).toLocaleDateString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="masterdata-form-actions" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
                <button type="button" className="masterdata-btn-secondary" onClick={closePackModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="masterdata-btn-primary" disabled={saving || Boolean(quantityError)}>
                  {saving ? "Saving..." : "Record Packing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PackingPage;
