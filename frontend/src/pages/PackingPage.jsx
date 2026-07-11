import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import Toolbar from "../components/common/Toolbar";
import SearchableSelect from "../components/common/SearchableSelect";
import useMasterData from "../hooks/useMasterData";

const emptyPackForm = { order_id: null, packed_quantity: "", packing_material_item_id: "", packing_material_qty: "", packed_by: "", remarks: "" };

function PackingPage() {
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
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

  const openPackModal = (order) => {
    setActiveOrder(order);
    setPackForm({ ...emptyPackForm, order_id: order.id, packed_quantity: String(order.remainingToPack) });
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
        }
        actions={
          <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
        }
      />

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
                {orders.map((order, idx) => (
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
