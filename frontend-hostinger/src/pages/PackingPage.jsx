import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import Toolbar from "../components/common/Toolbar";
import SearchableSelect from "../components/common/SearchableSelect";
import useMasterData from "../hooks/useMasterData";
import { exportRowsToExcel } from "../utils/exportExcel";
import { useIsMobile } from "../hooks/useIsMobile";
import { pickMobileRecent } from "../utils/mobileRecent";
import MobileListCard from "../components/common/MobileListCard";

const emptyPackForm = { order_id: null, packed_quantity: "", packing_material_item_id: "", packing_material_qty: "", packed_by: "", remarks: "" };

function PackingPage() {
  const masterData = useMasterData();
  const [activeTab, setActiveTab] = useState("queue");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [newPackSearch, setNewPackSearch] = useState("");
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
      const items = Array.isArray(data?.items) ? data.items : [];
      setOrders(items.filter((order) => order.remainingToPack > 0));
      setAllOrders(items);
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
      { key: "remainingToDispatch", header: "Remaining to Dispatch" }
    ];
    const rows = orders.map((order) => ({
      orderNo:             order.orderNo || "-",
      product:             order.product || "-",
      client:              order.clientName || "-",
      quantity:            order.quantity ?? "-",
      unit:                order.unit || "-",
      packedQuantity:      order.packedQuantity ?? 0,
      remainingToPack:     order.remainingToPack ?? 0,
      remainingToDispatch: order.remainingToDispatch ?? 0
    }));
    exportRowsToExcel("packing", columns, rows);
  };

  const filteredOrdersForNewPack = useMemo(() => {
    if (!newPackSearch.trim()) return allOrders;
    const q = newPackSearch.toLowerCase();
    return allOrders.filter(
      (order) =>
        (order.orderNo || "").toLowerCase().includes(q) ||
        (order.product || "").toLowerCase().includes(q) ||
        (order.clientName || "").toLowerCase().includes(q)
    );
  }, [allOrders, newPackSearch]);

  const openPackModal = (order) => {
    setActiveOrder(order);
    setPackForm({ ...emptyPackForm, order_id: order.id, packed_quantity: String(order.remainingToPack) });
  };

  const openNewPackModal = (order) => {
    setActiveTab("queue");
    openPackModal(order);
  };

  const closePackModal = () => {
    if (saving) return;
    setActiveOrder(null);
    setPackForm(emptyPackForm);
  };

  const submitPack = async (e) => {
    e.preventDefault();
    if (saving) return;
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

  return (
    <div className="order-page">
      <Toolbar
        title="Packing"
        search={
          activeTab === "queue" ? (
            <div className="ui-toolbar-search">
              <SearchIcon />
              <input
                placeholder="Search order, client or product..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearchSubmit();
                }}
              />
            </div>
          ) : null
        }
        actions={
          <>
            {activeTab === "queue" && (
              <>
                <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
                <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
              </>
            )}
          </>
        }
      />

      <div className="order-tabs" style={{ display: "flex", gap: 8, padding: "16px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
        <button
          className={`order-tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "queue" ? "2px solid #1d4ed8" : "2px solid transparent",
            background: "transparent",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: activeTab === "queue" ? 600 : 400,
            color: activeTab === "queue" ? "#1d4ed8" : "#64748b"
          }}
        >
          Queue
        </button>
        <button
          className={`order-tab-btn ${activeTab === "new" ? "active" : ""}`}
          onClick={() => setActiveTab("new")}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "new" ? "2px solid #1d4ed8" : "2px solid transparent",
            background: "transparent",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: activeTab === "new" ? 600 : 400,
            color: activeTab === "new" ? "#1d4ed8" : "#64748b"
          }}
        >
          New Packing
        </button>
      </div>

      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {activeTab === "queue" ? (
          <>
            {loading ? (
              <div className="order-skeleton-list" style={{ padding: 20 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="order-skeleton-row" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="order-empty-state">
                <div className="order-empty-icon"><BoxesIcon /></div>
                <p>Nothing waiting to be packed</p>
                <p style={{ color: "#64748b", marginTop: 6 }}>Orders appear here once their finished goods clear QC.</p>
              </div>
            ) : (
          <div className="order-table-wrap">
            <div className="order-table-meta">
              {orders.length} order{orders.length !== 1 ? "s" : ""} ready to pack
            </div>
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Order No</th>
                  <th>Product</th>
                  <th>Client</th>
                  <th style={{ textAlign: "right" }}>Order Qty</th>
                  <th style={{ textAlign: "right" }}>Packed</th>
                  <th style={{ textAlign: "right" }}>Remaining to Pack</th>
                  <th style={{ textAlign: "right" }}>Ready to Dispatch</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((order, idx) => (
                  <tr key={order.id}>
                    <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{order.orderNo || "-"}</td>
                    <td>{order.product || "-"}</td>
                    <td>{order.clientName || "-"}</td>
                    <td style={{ textAlign: "right" }}>{order.quantity} {order.unit}</td>
                    <td style={{ textAlign: "right" }}>{order.packedQuantity}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{order.remainingToPack}</td>
                    <td style={{ textAlign: "right" }}>{order.remainingToDispatch}</td>
                    <td>
                      <button className="order-btn-secondary" onClick={() => openPackModal(order)}>
                        Record Packing
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

            {isMobile && !loading && orders.length > 0 && (
              <div className="order-mobile-list">
                {displayOrders.map((order) => (
                  <MobileListCard
                    key={order.id}
                    title={order.orderNo || "—"}
                    subtitle={order.product || "-"}
                    badge={`${order.remainingToPack} to pack`}
                    badgeColor={Number(order.remainingToPack) > 0 ? "orange" : "green"}
                    fields={[
                      { label: "Client", value: order.clientName || "-" },
                      { label: "Order Qty", value: `${order.quantity} ${order.unit || ""}`.trim() },
                      { label: "Packed", value: order.packedQuantity },
                      { label: "Ready to Dispatch", value: order.remainingToDispatch }
                    ]}
                    onActionClick={() => openPackModal(order)}
                    actionLabel="Record Packing"
                  />
                ))}
                {showingRecentOnly && (
                  <div className="mobile-recent-hint">
                    Showing the 5 most recent. Search to find any order.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Search Orders <span className="req">*</span></label>
              <div className="ui-toolbar-search" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", background: "#fff" }}>
                <SearchIcon />
                <input
                  placeholder="Search order, client or product..."
                  value={newPackSearch}
                  onChange={(e) => setNewPackSearch(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    flex: 1,
                    fontSize: 14
                  }}
                />
              </div>
              <small style={{ color: "#64748b", marginTop: 6, display: "block" }}>
                Only shows orders ready for packing (finished goods cleared QC)
              </small>
            </div>

            {filteredOrdersForNewPack.length === 0 ? (
              <div className="order-empty-state">
                <div className="order-empty-icon"><BoxesIcon /></div>
                <p>{newPackSearch ? "No orders found" : "No orders ready to pack"}</p>
              </div>
            ) : (
              <div className="order-table-wrap">
                <div className="order-table-meta">
                  {filteredOrdersForNewPack.length} order{filteredOrdersForNewPack.length !== 1 ? "s" : ""} available
                </div>
                <table className="order-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th>Order No</th>
                      <th>Product</th>
                      <th>Client</th>
                      <th style={{ textAlign: "right" }}>Order Qty</th>
                      <th style={{ textAlign: "right" }}>Packed</th>
                      <th style={{ textAlign: "right" }}>Remaining to Pack</th>
                      <th style={{ textAlign: "right" }}>Ready to Dispatch</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrdersForNewPack.map((order, idx) => (
                      <tr key={order.id}>
                        <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{order.orderNo || "-"}</td>
                        <td>{order.product || "-"}</td>
                        <td>{order.clientName || "-"}</td>
                        <td style={{ textAlign: "right" }}>{order.quantity} {order.unit}</td>
                        <td style={{ textAlign: "right" }}>{order.packedQuantity}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{order.remainingToPack}</td>
                        <td style={{ textAlign: "right" }}>{order.remainingToDispatch}</td>
                        <td>
                          <button className="order-btn-secondary" onClick={() => openNewPackModal(order)}>
                            Record Packing
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {activeOrder && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card" style={{ width: "min(480px, 100%)" }}>
            <div className="masterdata-modal-head">
              <div>
                <h3>Record Packing</h3>
                <p>{activeOrder.orderNo} — {activeOrder.product} for {activeOrder.clientName}</p>
              </div>
              <button className="masterdata-modal-close-btn" onClick={closePackModal} disabled={saving} type="button">
                X Close
              </button>
            </div>

            <form onSubmit={submitPack}>
              <div className="masterdata-form-grid">
                <div>
                  <label className="label">Quantity to Pack <span className="req">*</span></label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={activeOrder.remainingToPack}
                    value={packForm.packed_quantity}
                    onChange={(e) => setPackForm((p) => ({ ...p, packed_quantity: e.target.value }))}
                    required
                  />
                  <small style={{ color: "#64748b" }}>Remaining to pack: {activeOrder.remainingToPack} {activeOrder.unit}</small>
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
                </div>
                <div>
                  <label className="label">Packing Material Used <span className="req">*</span></label>
                  <input
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
                  <input
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

              <div className="masterdata-form-actions" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
                <button type="button" className="masterdata-btn-secondary" onClick={closePackModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="masterdata-btn-primary" disabled={saving}>
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
