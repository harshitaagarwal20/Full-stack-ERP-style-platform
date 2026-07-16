import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import { minEntryDateFor } from "../utils/dateRules";

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

  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    received_date:      today(),
    received_by:        "",
    vehicle_ref:        "",
    warehouse_location: "",
    remarks:            "",
    items:              []
  });

  // A receipt is only meaningful against what is still outstanding, so the
  // summary strip and the over-receipt guard both work off this.
  const receiving = form.items.filter((item) => Number(item.quantity_received) > 0);
  const receivingQty = receiving.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0);
  const overReceipt = form.items.some(
    (item) => Number(item.quantity_received || 0) > Number(item.remaining || 0)
  );
  const allSettled = form.items.length > 0 && form.items.every((item) => Number(item.remaining) <= 0);

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

  // Fill every outstanding line with what is still due — the common case when a
  // full consignment turns up.
  const receiveAllRemaining = () => {
    setFormError("");
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({
        ...item,
        quantity_received: item.remaining > 0 ? item.remaining : item.quantity_received
      }))
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!po) {
      setFormError("Select a purchase order first.");
      return;
    }

    const receivingItems = form.items.filter((i) => Number(i.quantity_received) > 0);
    if (!receivingItems.length) {
      setFormError("Enter a received quantity for at least one item.");
      return;
    }

    if (overReceipt) {
      setFormError("A line is receiving more than is outstanding. Reduce it to the remaining quantity or less.");
      return;
    }

    setFormError("");
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
          <h3 className="grn-section-title">Select Purchase Order</h3>
          <div style={{ maxWidth: 480 }}>
            <label className="label">Purchase Order</label>
            <SearchableSelect
              options={poOptions.map((p) => ({
                value: p.id,
                label: `${p.poNumber} — ${p.supplier?.name} (${p.status})`
              }))}
              value={poIdInput}
              onChange={(value) => {
                setPoIdInput(value);
                if (value) loadPO(Number(value));
              }}
              placeholder={
                loadingOptions
                  ? "Loading purchase orders..."
                  : optionsError
                  ? "Failed to load — refresh to retry"
                  : poOptions.length === 0
                  ? "No purchase orders found"
                  : "— Select a PO —"
              }
            />
          </div>
        </section>
      )}

      {po && (
        <form onSubmit={onSubmit}>
          <section className="order-card grn-po-strip">
            <div>
              <span className="grn-po-strip-label">Purchase Order</span>
              <span className="grn-po-strip-value">{po.poNumber}</span>
            </div>
            <div>
              <span className="grn-po-strip-label">Supplier</span>
              <span className="grn-po-strip-value">{po.supplier?.name || "-"}</span>
            </div>
            <div>
              <span className="grn-po-strip-label">Status</span>
              <span className="grn-po-strip-value">{po.status}</span>
            </div>
            <div>
              <span className="grn-po-strip-label">Lines outstanding</span>
              <span className="grn-po-strip-value">
                {form.items.filter((item) => Number(item.remaining) > 0).length} of {form.items.length}
              </span>
            </div>
          </section>

          <section className="order-card">
            <h3 className="grn-section-title">Receipt Details</h3>
            <div className="order-form-grid">
              <div>
                <label className="label">Received Date</label>
                <input autoComplete="off"
                  className="input"
                  type="date"
                  min={minEntryDateFor(form.received_date)}
                  value={form.received_date}
                  onChange={(e) => setFormField("received_date", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Received By</label>
                <input autoComplete="off"
                  className="input"
                  placeholder="Name of receiver"
                  value={form.received_by}
                  onChange={(e) => setFormField("received_by", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Vehicle / Delivery Ref</label>
                <input autoComplete="off"
                  className="input"
                  placeholder="e.g. TN-01-AB-1234"
                  value={form.vehicle_ref}
                  onChange={(e) => setFormField("vehicle_ref", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Warehouse Location</label>
                <input autoComplete="off"
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
            <div className="grn-items-head">
              <h3 className="grn-section-title">Line Items ({form.items.length})</h3>
              {!allSettled && (
                <button type="button" className="order-btn-secondary" onClick={receiveAllRemaining}>
                  Receive all remaining
                </button>
              )}
            </div>

            {allSettled && (
              <p className="grn-note grn-note-done">
                Every line on this PO has been fully received. There is nothing left to receipt.
              </p>
            )}

            <div className="responsive-table-wrap">
              <table className="order-table responsive-table">
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
                  {form.items.map((item, index) => {
                    const settled = Number(item.remaining) <= 0;
                    const entered = Number(item.quantity_received || 0);
                    const exceeds = entered > Number(item.remaining || 0);
                    const rowClass = [
                      settled ? "grn-row-done" : "",
                      exceeds ? "grn-row-over" : entered > 0 ? "grn-row-active" : ""
                    ].filter(Boolean).join(" ");

                    return (
                      <tr key={item.po_item_id} className={rowClass}>
                        <td data-label="">{index + 1}</td>
                        <td data-label="Item" style={{ fontWeight: 600 }}>{item.item_id}</td>
                        <td data-label="Category">{item.category || "-"}</td>
                        <td data-label="Grade">{item.grade || "-"}</td>
                        <td data-label="UOM">{item.uom || "-"}</td>
                        <td data-label="Qty Ordered">{item.qty_ordered}</td>
                        <td data-label="Already Received">{item.already_received}</td>
                        <td data-label="Remaining">
                          {settled
                            ? <span className="grn-pill grn-pill-done">Fully received</span>
                            : <span className="grn-remaining">{item.remaining} {item.uom}</span>}
                        </td>
                        <td data-label="Receiving Now *">
                          <div className="grn-qty-cell">
                            <input autoComplete="off"
                              className={`input grn-qty-input${exceeds ? " input-error" : ""}`}
                              type="number"
                              min="0"
                              max={item.remaining}
                              step="any"
                              placeholder="0"
                              disabled={settled}
                              value={item.quantity_received}
                              onChange={(e) => { setFormError(""); setItemField(index, "quantity_received", e.target.value); }}
                            />
                            {!settled && entered !== Number(item.remaining) && (
                              <button
                                type="button"
                                className="grn-fill-btn"
                                onClick={() => { setFormError(""); setItemField(index, "quantity_received", item.remaining); }}
                              >
                                All
                              </button>
                            )}
                          </div>
                          {exceeds && (
                            <span className="grn-cell-error">Only {item.remaining} outstanding</span>
                          )}
                        </td>
                        <td data-label="Item Remarks">
                          <input autoComplete="off"
                            className="input"
                            style={{ minWidth: 120 }}
                            placeholder="Remarks"
                            disabled={settled}
                            value={item.remarks}
                            onChange={(e) => setItemField(index, "remarks", e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="order-card grn-footer">
            <div className="grn-footer-summary">
              {receiving.length === 0 ? (
                <span className="grn-footer-muted">Nothing entered yet — enter a quantity on at least one line.</span>
              ) : (
                <span>
                  Receiving <strong>{receivingQty}</strong> across{" "}
                  <strong>{receiving.length}</strong> line{receiving.length === 1 ? "" : "s"}
                </span>
              )}
              {formError && <span className="grn-footer-error">{formError}</span>}
            </div>
            <div className="grn-footer-actions">
              <button type="button" className="order-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="order-btn-primary"
                disabled={saving || receiving.length === 0 || overReceipt}
              >
                {saving ? "Saving..." : "Save GRN"}
              </button>
            </div>
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
      <section className="order-card grn-header">
        <button className="order-btn-secondary" onClick={handleClose}>← Back</button>
        <div className="grn-header-title">
          <h2>New Goods Receipt Note</h2>
          <p>
            {po
              ? `Receiving against ${po.poNumber} — ${po.supplier?.name || ""}`
              : "Select the purchase order this consignment arrived against."}
          </p>
        </div>
      </section>
      {formBody}
    </div>
  );
}

export default GrnFormPage;
