import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { splitTax, formatPct } from "../utils/gst";
import { getShipToLocation } from "../config/shipToLocations";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatCurrency(val) {
  if (!val && val !== 0) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(val);
}

function rowTotal(item) {
  return Number(item.quantity_ordered || 0) * Number(item.unit_price || 0);
}

function rowAfterTax(item) {
  return rowTotal(item) * (1 + Number(item.tax_percent || 0) / 100);
}

// The dedicated screen an accounts user works: the purchase team has already
// raised the requisition (supplier + what/how-much to order), and everything
// here is read-only except the money columns. Accounts fills the price, then
// either saves or releases the PO to the supplier — the one lifecycle
// transition the backend lets accounts own.
function PurchaseOrderPricingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPrice = user?.role === "admin" || user?.role === "accounts";

  const [po, setPo] = useState(null);
  const [items, setItems] = useState([]);
  const [totalDiscount, setTotalDiscount] = useState("");
  const [freight, setFreight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The backend strips pricing from anyone but admin/accounts anyway; bouncing
    // here just keeps a non-pricer from staring at a screen that can't save.
    if (!canPrice) {
      navigate(`/purchase-orders/${id}`, { replace: true });
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/purchase-orders/${id}`);
        if (cancelled) return;
        // Only a DRAFT can still be priced; once it is sent the money is locked.
        if (data.status !== "DRAFT") {
          navigate(`/purchase-orders/${id}`, { replace: true });
          return;
        }
        setPo(data);
        setItems(
          (data.items || []).map((item) => ({
            item_description: item.itemId || "",
            quantity_ordered: String(item.qty ?? ""),
            grade: item.grade || "",
            category: item.category || "",
            uom: item.uom || "",
            batch_no: item.batchNo || "",
            outward_key: item.outwardKey || "",
            remark: item.remark || "",
            unit_price: item.unitPrice ? String(item.unitPrice) : "",
            tax_percent: String(item.taxPercent ?? 18),
            currency: item.currency || "INR"
          }))
        );
        setTotalDiscount(data.totalDiscount ? String(data.totalDiscount) : "");
        setFreight(data.freight || "");
      } catch (error) {
        logApiError(error, "Failed to load purchase order");
        navigate("/purchase-orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id, canPrice]);

  const setItemPrice = (index, key, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const grossTotal = useMemo(() => items.reduce((sum, item) => sum + rowAfterTax(item), 0), [items]);
  const netTotal = useMemo(
    () => Math.max(0, grossTotal - Number(totalDiscount || 0)) + Number(freight || 0),
    [grossTotal, totalDiscount, freight]
  );

  const allPriced = items.length > 0 && items.every((item) => Number(item.unit_price || 0) > 0);

  const buildPayload = () => ({
    // Round-trip the requisition fields untouched — the backend replaces the
    // whole item set on save, so anything omitted here would be lost.
    order_date: po.orderDate ? po.orderDate.slice(0, 10) : undefined,
    total_discount: Number(totalDiscount || 0),
    freight: freight || null,
    items: items.map((item) => ({
      item_description: item.item_description,
      quantity_ordered: Number(item.quantity_ordered) || 1,
      grade: item.grade || null,
      category: item.category || null,
      uom: item.uom || null,
      batch_no: item.batch_no || null,
      outward_key: item.outward_key || null,
      remark: item.remark || null,
      unit_price: Number(item.unit_price) || 0,
      tax_percent: Number(item.tax_percent) || 0,
      currency: item.currency || "INR"
    }))
  });

  const savePricing = async () => {
    if (saving) return false;
    setSaving(true);
    try {
      await api.put(`/purchase-orders/${id}`, buildPayload());
      return true;
    } catch (error) {
      logApiError(error, "Failed to save pricing");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (await savePricing()) {
      dispatchUserMessage("Pricing saved.", { title: "Saved", variant: "success" });
      navigate(`/purchase-orders/${id}`);
    }
  };

  const handleSaveAndSend = async () => {
    if (!allPriced) {
      window.alert("Add a price to every item before sending the PO to the supplier.");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/purchase-orders/${id}`, buildPayload());
      await api.patch(`/purchase-orders/${id}/status`, { status: "SENT_TO_SUPPLIER" });
      dispatchUserMessage("Purchase order priced and sent to supplier.", { title: "Sent", variant: "success" });
      navigate(`/purchase-orders/${id}`);
    } catch (error) {
      logApiError(error, "Failed to send purchase order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <div className="order-skeleton-list">
          <div className="order-skeleton-row" />
          <div className="order-skeleton-row" />
        </div>
      </div>
    );
  }

  if (!po) return null;

  // One tax rate is entered per line; how it is charged is decided by place of
  // supply. Same state as the Ship To → intra-state, split half SGST / half
  // CGST; different state (or an unreadable supplier GSTIN) → the whole rate is
  // IGST. splitTax owns that rule so this screen and the PO detail never
  // disagree.
  const shipToLocation = getShipToLocation(po.shipTo);
  const supplierGstin = po.supplier?.gstNo;
  const shipToGstin = shipToLocation?.gstin;

  return (
    <div className="order-page">
      <section className="order-card order-header-card">
        <div>
          <button
            className="order-btn-secondary"
            style={{ marginRight: 12 }}
            onClick={() => navigate(`/purchase-orders/${id}`)}
          >
            ← Back
          </button>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            Add Pricing — {po.poNumber}
          </span>
        </div>
      </section>

      {/* Requisition summary — read-only. This is the "what to order" the
          purchase team raised; accounts only fills the money. */}
      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Requisition</h3>
        <div className="order-detail-grid">
          <p><span>Supplier</span> {po.supplier?.name || "-"}</p>
          <p><span>Order Date</span> {formatDate(po.orderDate)}</p>
          <p><span>Expected Delivery</span> {formatDate(po.expectedDeliveryDate)}</p>
          <p><span>Category</span> {po.category || "-"}</p>
          <p><span>Ship To</span> {po.shipTo || "-"}</p>
          <p><span>Raised By</span> {po.createdBy?.name || "-"}</p>
        </div>
      </section>

      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Line Items — Fill Pricing</h3>
        <div className="responsive-table-wrap">
          <table className="order-table responsive-table order-table--compact po-pricing-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>UoM</th>
                <th>Grade</th>
                <th>Qty</th>
                <th>Price/Unit</th>
                <th>Total</th>
                <th>Tax %</th>
                <th>SGST</th>
                <th>CGST</th>
                <th>IGST</th>
                <th>Amt After Tax</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const tax = splitTax(item.tax_percent, supplierGstin, shipToGstin);
                return (
                <tr key={index}>
                  <td data-label="">{index + 1}</td>
                  <td data-label="Item" style={{ fontWeight: 600, color: "#0f172a" }}>{item.item_description || "-"}</td>
                  <td data-label="UoM">{item.uom || "-"}</td>
                  <td data-label="Grade">{item.grade || "-"}</td>
                  <td data-label="Qty">{item.quantity_ordered || "-"}</td>
                  <td data-label="Price/Unit">
                    <input autoComplete="off"
                      className="input"
                      style={{ minWidth: 88 }}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.unit_price}
                      onChange={(e) => setItemPrice(index, "unit_price", e.target.value)}
                    />
                  </td>
                  <td data-label="Total" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {rowTotal(item) > 0 ? formatCurrency(rowTotal(item)) : "-"}
                  </td>
                  <td data-label="Tax %">
                    <input autoComplete="off"
                      className="input"
                      style={{ minWidth: 58 }}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="18"
                      value={item.tax_percent}
                      onChange={(e) => setItemPrice(index, "tax_percent", e.target.value)}
                    />
                  </td>
                  <td data-label="SGST">{formatPct(tax.sgst)}</td>
                  <td data-label="CGST">{formatPct(tax.cgst)}</td>
                  <td data-label="IGST">{formatPct(tax.igst)}</td>
                  <td data-label="Amt After Tax" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {rowAfterTax(item) > 0 ? formatCurrency(rowAfterTax(item)) : "-"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Charges & Total</h3>
        <div className="order-form-grid">
          <div>
            <label className="label">Discount (INR)</label>
            <input autoComplete="off"
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={totalDiscount}
              onChange={(e) => setTotalDiscount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Freight</label>
            <input autoComplete="off"
              className="input"
              placeholder="Freight charges / terms"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16, alignItems: "flex-end" }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Gross (after tax): <strong style={{ color: "#0f172a" }}>{formatCurrency(grossTotal)}</strong>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
            Net Payable: {formatCurrency(netTotal)}
          </div>
        </div>
      </section>

      <section className="order-card order-form-actions">
        <button type="button" className="order-btn-secondary" onClick={() => navigate(`/purchase-orders/${id}`)}>
          Cancel
        </button>
        <button type="button" className="order-btn-secondary" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save Pricing"}
        </button>
        <button type="button" className="order-btn-primary" disabled={saving || !allPriced} onClick={handleSaveAndSend}>
          {saving ? "Working..." : "Save & Send to Supplier"}
        </button>
      </section>
    </div>
  );
}

export default PurchaseOrderPricingPage;
