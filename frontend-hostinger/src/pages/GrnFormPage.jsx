import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function GrnFormPage({ isModal = false, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poIdParam = searchParams.get("po_id");

  const [loadingPO, setLoadingPO]       = useState(Boolean(poIdParam));
  const [saving, setSaving]             = useState(false);
  const [po, setPo]                     = useState(null);
  const [poIdInput, setPoIdInput]       = useState(poIdParam || "");
  const [poOptions, setPoOptions]       = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState(false);

  const [form, setForm] = useState({
    received_date:      today(),
    received_by:        "",
    vehicle_ref:        "",
    warehouse_location: "",
    remarks:            "",
    items:              []
  });

  useEffect(() => {
    if (!poIdParam) {
      setLoadingOptions(true);
      setOptionsError(false);
      api.get("/purchase-orders", { params: { status: "all", limit: 500 } })
        .then((res) => {
          setPoOptions(Array.isArray(res.data?.items) ? res.data.items : []);
        })
        .catch((err) => {
          logApiError(err, "Failed to load purchase orders for GRN");
          setOptionsError(true);
        })
        .finally(() => setLoadingOptions(false));
    }
  }, [poIdParam]);

  const loadPO = async (id) => {
    if (!id) return;
    setLoadingPO(true);
    try {
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPo(data);
      setForm((prev) => ({
        ...prev,
        items: (data.items || []).map((item) => ({
          po_item_id:        item.id,
          item_id:           item.itemId,
          category:          item.category  || "",
          grade:             item.grade     || "",
          uom:               item.uom       || "",
          qty_ordered:       item.qty,
          already_received:  item.receivedQty,
          remaining:         item.qty - item.receivedQty,
          quantity_received: 0,
          remarks:           ""
        }))
      }));
    } catch (error) {
      logApiError(error, "Failed to load purchase order");
    } finally {
      setLoadingPO(false);
    }
  };

  useEffect(() => {
    if (poIdParam) loadPO(Number(poIdParam));
  }, [poIdParam]);

  const setFormField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setItemField = (index, key, value) => {
    setForm((prev) => {
      const items = prev.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      );
      return { ...prev, items };
    });
  };

  const handleClose = () => {
    if (onClose) onClose();
    else navigate(po ? `/purchase-orders/${po.id}` : "/grns");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!po) {
      window.alert("Please select a Purchase Order.");
      return;
    }

    const receivingItems = form.items.filter((i) => Number(i.quantity_received) > 0);
    if (!receivingItems.length) {
      window.alert("Enter a received quantity for at least one item.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        po_id:              po.id,
        received_date:      form.received_date || null,
        received_by:        form.received_by   || null,
        vehicle_ref:        form.vehicle_ref   || null,
        warehouse_location: form.warehouse_location || null,
        remarks:            form.remarks       || null,
        items: receivingItems.map((i) => ({
          po_item_id:        i.po_item_id,
          quantity_received: Number(i.quantity_received)
        }))
      };

      const res = await api.post("/grns", payload);
      dispatchUserMessage("Goods receipt note created successfully.", { title: "Created", variant: "success" });
      if (onSuccess) onSuccess(res.data.id);
      else navigate(`/grns/${res.data.id}`);
    } catch (error) {
      logApiError(error, "Failed to create GRN");
    } finally {
      setSaving(false);
    }
  };

  const skeleton = (
    <div className="order-skeleton-list" style={{ padding: 20 }}>
      <div className="order-skeleton-row" />
      <div className="order-skeleton-row" />
    </div>
  );

  const formBody = (
    <>
      {!poIdParam && (
        <section className="order-card">
          <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Select Purchase Order</h3>
          <div style={{ maxWidth: 480 }}>
            <label className="label">Purchase Order</label>
            <select
              className="input"
              value={poIdInput}
              disabled={loadingOptions}
              onChange={(e) => {
                const val = e.target.value;
                setPoIdInput(val);
                if (val) loadPO(Number(val));
              }}
            >
              <option value="">
                {loadingOptions ? "Loading purchase orders..." : optionsError ? "Failed to load — refresh to retry" : poOptions.length === 0 ? "No purchase orders found" : "— Select a PO —"}
              </option>
              {poOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber} — {p.supplier?.name} ({p.status})
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {po && (
        <form onSubmit={onSubmit}>
          <section className="order-card">
            <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Receipt Details</h3>
            <div className="order-form-grid">
              <div>
                <label className="label">Received Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.received_date}
                  onChange={(e) => setFormField("received_date", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Received By</label>
                <input
                  className="input"
                  placeholder="Name of receiver"
                  value={form.received_by}
                  onChange={(e) => setFormField("received_by", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Vehicle / Delivery Ref</label>
                <input
                  className="input"
                  placeholder="e.g. TN-01-AB-1234"
                  value={form.vehicle_ref}
                  onChange={(e) => setFormField("vehicle_ref", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Warehouse Location</label>
                <input
                  className="input"
                  placeholder="e.g. Warehouse A, Bay 3"
                  value={form.warehouse_location}
                  onChange={(e) => setFormField("warehouse_location", e.target.value)}
                />
              </div>
              <div className="full-row">
                <label className="label">Remarks</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Optional remarks..."
                  value={form.remarks}
                  onChange={(e) => setFormField("remarks", e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          </section>

          <section className="order-card">
            <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>
              Line Items ({form.items.length})
            </h3>
            <div className="order-table-wrap">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Grade</th>
                    <th>UOM</th>
                    <th>Qty Ordered</th>
                    <th>Already Received</th>
                    <th>Remaining</th>
                    <th>Receiving Now *</th>
                    <th>Item Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={item.po_item_id}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.item_id}</td>
                      <td>{item.category || "-"}</td>
                      <td>{item.grade || "-"}</td>
                      <td>{item.uom || "-"}</td>
                      <td>{item.qty_ordered}</td>
                      <td>{item.already_received}</td>
                      <td style={{ fontWeight: 600, color: item.remaining <= 0 ? "#16a34a" : "#0f172a" }}>
                        {item.remaining <= 0 ? "✓ Done" : item.remaining}
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ minWidth: 80 }}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.quantity_received}
                          onChange={(e) => setItemField(index, "quantity_received", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ minWidth: 120 }}
                          placeholder="Remarks"
                          value={item.remarks}
                          onChange={(e) => setItemField(index, "remarks", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="order-card" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="order-btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="order-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save GRN"}
            </button>
          </section>
        </form>
      )}
    </>
  );

  if (isModal) {
    return (
      <div className="order-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div className="order-modal-card large" style={{ maxWidth: "min(100%, 1100px)" }}>
          <div className="order-modal-head" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                New Goods Receipt Note
              </h3>
              {po && (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                  for {po.poNumber} — {po.supplier?.name}
                </p>
              )}
            </div>
            <button className="order-modal-close-btn" onClick={handleClose}>✕</button>
          </div>
          {loadingPO ? skeleton : formBody}
        </div>
      </div>
    );
  }

  if (loadingPO) {
    return <div className="order-page">{skeleton}</div>;
  }

  return (
    <div className="order-page">
      <section className="order-card order-header-card">
        <div>
          <button
            className="order-btn-secondary"
            style={{ marginRight: 12 }}
            onClick={handleClose}
          >
            ← Back
          </button>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            New Goods Receipt Note
          </span>
          {po && (
            <span style={{ fontSize: 13, color: "#64748b", marginLeft: 10 }}>
              for {po.poNumber} — {po.supplier?.name}
            </span>
          )}
        </div>
      </section>
      {formBody}
    </div>
  );
}

export default GrnFormPage;
