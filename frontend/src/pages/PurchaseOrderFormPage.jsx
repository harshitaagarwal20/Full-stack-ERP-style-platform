import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { TrashIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import useMasterData from "../hooks/useMasterData";
import SearchableSelect from "../components/common/SearchableSelect";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyItem() {
  return {
    item_description: "",
    quantity_ordered: "",
    unit_price: "",
    grade: "",
    currency: "INR",
    tax_percent: "18",
    category: "",
    uom: "",
    batch_no: "",
    outward_key: ""
  };
}

function createEmptyForm() {
  return {
    supplier_name:            "",
    supplier_code:            "",
    supplier_address:         "",
    supplier_pincode:         "",
    order_date:               today(),
    expected_delivery_date:   "",
    category:                 "",
    notes:                    "",
    items:                    [createEmptyItem()]
  };
}

function calcRowTotal(item) {
  return Number(item.quantity_ordered || 0) * Number(item.unit_price || 0);
}

function calcRowAmountAfterTax(item) {
  const total = calcRowTotal(item);
  return total * (1 + Number(item.tax_percent || 0) / 100);
}

function calcGrandTotal(items) {
  return items.reduce((sum, item) => sum + calcRowAmountAfterTax(item), 0);
}

function formatCurrency(val) {
  if (!val && val !== 0) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(val);
}

const CATEGORY_OPTIONS = ["LM", "RM", "PM", "OM"];

function PurchaseOrderFormPage({ isModal = false, onClose, onSuccess }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const masterData = useMasterData();
  const productOptions = useMemo(() => {
    return Array.isArray(masterData.products) ? masterData.products : [];
  }, [masterData.products]);
  const supplierMaster = useMemo(() => {
    return Array.isArray(masterData.supplierMaster) ? masterData.supplierMaster : [];
  }, [masterData.supplierMaster]);

  const supplierOptions = useMemo(() =>
    supplierMaster.map((s) => ({
      value: s.supplierName,
      label: s.supplierName,
      searchText: [s.supplierName, s.supplierCode].filter(Boolean).join(" ")
    })),
    [supplierMaster]
  );

  const [form, setForm] = useState(createEmptyForm());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/purchase-orders/${id}`);
        if (data.status !== "DRAFT") {
          navigate(`/purchase-orders/${id}`, { replace: true });
          return;
        }
        setForm({
          supplier_name:           data.supplier?.name           || "",
          supplier_code:           data.supplier?.supplierCode   || "",
          supplier_address:        data.supplier?.address        || "",
          supplier_pincode:        data.supplier?.pincode        || "",
          order_date: data.orderDate ? data.orderDate.slice(0, 10) : today(),
          expected_delivery_date: data.expectedDeliveryDate ? data.expectedDeliveryDate.slice(0, 10) : "",
          category: data.category || data.department || "",
          notes: data.notes || "",
          items: data.items?.length
            ? data.items.map((item) => ({
                item_description: item.itemId || "",
                quantity_ordered: String(item.qty),
                unit_price: String(item.unitPrice || ""),
                grade: item.grade || "",
                currency: item.currency || "INR",
                tax_percent: String(item.taxPercent ?? 18),
                category: item.category || "",
                uom: item.uom || "",
                batch_no: item.batchNo || "",
                outward_key: item.outwardKey || ""
              }))
            : [createEmptyItem()]
        });
      } catch (error) {
        logApiError(error, "Failed to load purchase order");
        navigate("/purchase-orders");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSupplierSelect = (name) => {
    const matched = supplierMaster.find((s) => s.supplierName === name);
    if (matched) {
      setForm((prev) => ({
        ...prev,
        supplier_name:    matched.supplierName,
        supplier_code:    matched.supplierCode  || prev.supplier_code,
        supplier_address: matched.address       || prev.supplier_address,
        supplier_pincode: matched.pincode       || prev.supplier_pincode,
      }));
    } else {
      setField("supplier_name", name);
    }
  };

  const setItem = (index, key, value) => {
    setForm((prev) => {
      const items = prev.items.map((item, i) => i === index ? { ...item, [key]: value } : item);
      return { ...prev, items };
    });
  };

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));

  const removeItem = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const handleClose = () => {
    if (onClose) onClose();
    else navigate("/purchase-orders");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const validItems = form.items.filter((item) => String(item.item_description || "").trim());
    if (!validItems.length) {
      window.alert("Add at least one item.");
      return;
    }
    if (!String(form.supplier_name || "").trim()) {
      window.alert("Supplier name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplier_name:            form.supplier_name.trim(),
        supplier_code:            form.supplier_code            || null,
        supplier_address:         form.supplier_address         || null,
        supplier_pincode:         form.supplier_pincode         || null,
        order_date: form.order_date || null,
        expected_delivery_date: form.expected_delivery_date || null,
        category: form.category || null,
        department: form.category || null,
        notes: form.notes || null,
        items: validItems.map((item) => ({
          item_description: item.item_description.trim(),
          quantity_ordered: Number(item.quantity_ordered) || 1,
          unit_price: Number(item.unit_price) || 0,
          grade: item.grade || null,
          currency: item.currency || "INR",
          tax_percent: Number(item.tax_percent) || 0,
          category: item.category || null,
          uom: item.uom || null,
          batch_no: item.batch_no || null,
          outward_key: item.outward_key || null
        }))
      };

      if (isEdit) {
        await api.put(`/purchase-orders/${id}`, payload);
        dispatchUserMessage("Purchase order updated successfully.", { title: "Saved", variant: "success" });
        if (onSuccess) onSuccess(id);
        else navigate(`/purchase-orders/${id}`);
      } else {
        const res = await api.post("/purchase-orders", payload);
        dispatchUserMessage("Purchase order created successfully.", { title: "Created", variant: "success" });
        if (onSuccess) onSuccess(res.data.id);
        else navigate(`/purchase-orders/${res.data.id}`);
      }
    } catch (error) {
      logApiError(error, "Failed to save purchase order");
    } finally {
      setSaving(false);
    }
  };

  const grandTotal = calcGrandTotal(form.items);

  const formContent = (
    <form onSubmit={onSubmit}>
      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Order Details</h3>
        <div className="order-form-grid">
          <div>
            <label className="label">Order Date</label>
            <input
              className="input"
              type="date"
              value={form.order_date}
              onChange={(e) => setField("order_date", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Expected Delivery Date</label>
            <input
              className="input"
              type="date"
              value={form.expected_delivery_date}
              onChange={(e) => setField("expected_delivery_date", e.target.value)}
            />
          </div>
          <div className="full-row">
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>
      </section>

      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>Vendor Details</h3>
        <div className="order-form-grid">
          <div>
            <label className="label">Vendor Name *</label>
            <SearchableSelect
              options={supplierOptions}
              value={form.supplier_name}
              onChange={handleSupplierSelect}
              placeholder="Search and select vendor..."
            />
          </div>
          <div>
            <label className="label">Supplier Code</label>
            <input
              className="input"
              placeholder="e.g. SUP-001"
              value={form.supplier_code}
              onChange={(e) => setField("supplier_code", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Pincode</label>
            <input
              className="input"
              placeholder="Pincode"
              value={form.supplier_pincode}
              onChange={(e) => setField("supplier_pincode", e.target.value)}
            />
          </div>
          <div className="full-row">
            <label className="label">Address</label>
            <input
              className="input"
              placeholder="Supplier address"
              value={form.supplier_address}
              onChange={(e) => setField("supplier_address", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="order-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#334155" }}>Line Items</h3>
          <button type="button" className="order-btn-primary ghost" onClick={addItem}>
            + Add Item
          </button>
        </div>

        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item *</th>
                <th>UoM</th>
                <th>Grade</th>
                <th>Currency</th>
                <th>Qty *</th>
                <th>Price/Unit</th>
                <th>Total</th>
                <th>Tax %</th>
                <th>Amt After Tax</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <select
                      className="input"
                      style={{ minWidth: 160 }}
                      value={item.item_description}
                      onChange={(e) => setItem(index, "item_description", e.target.value)}
                      required
                    >
                      <option value="">Select product</option>
                      {productOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 70 }}
                      placeholder="KG / MT"
                      value={item.uom}
                      onChange={(e) => setItem(index, "uom", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 80 }}
                      placeholder="Grade"
                      value={item.grade}
                      onChange={(e) => setItem(index, "grade", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 70 }}
                      placeholder="INR"
                      value={item.currency}
                      onChange={(e) => setItem(index, "currency", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 80 }}
                      type="number"
                      min="1"
                      placeholder="0"
                      value={item.quantity_ordered}
                      onChange={(e) => setItem(index, "quantity_ordered", e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 100 }}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.unit_price}
                      onChange={(e) => setItem(index, "unit_price", e.target.value)}
                    />
                  </td>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {calcRowTotal(item) > 0 ? formatCurrency(calcRowTotal(item)) : "-"}
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 70 }}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="18"
                      value={item.tax_percent}
                      onChange={(e) => setItem(index, "tax_percent", e.target.value)}
                    />
                  </td>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {calcRowAmountAfterTax(item) > 0 ? formatCurrency(calcRowAmountAfterTax(item)) : "-"}
                  </td>
                  <td>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label="Remove item"
                        onClick={() => removeItem(index)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9} style={{ textAlign: "right", fontWeight: 700, paddingRight: 12 }}>
                  Gross Amount
                </td>
                <td style={{ fontWeight: 700 }}>{grandTotal > 0 ? formatCurrency(grandTotal) : "-"}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="order-card" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button type="button" className="order-btn-secondary" onClick={handleClose}>
          Cancel
        </button>
        <button type="submit" className="order-btn-primary" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Purchase Order"}
        </button>
      </section>
    </form>
  );

  if (isModal) {
    return (
      <div className="order-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div className="order-modal-card large" style={{ maxWidth: "min(100%, 1200px)" }}>
          <div className="order-modal-head" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
              {isEdit ? "Edit Purchase Order" : "New Purchase Order"}
            </h3>
            <button className="order-modal-close-btn" onClick={handleClose}>✕</button>
          </div>
          {loading
            ? <div className="order-skeleton-list" style={{ padding: 20 }}><div className="order-skeleton-row" /></div>
            : formContent}
        </div>
      </div>
    );
  }

  if (loading) return <div className="order-skeleton-list"><div className="order-skeleton-row" /></div>;

  return (
    <div className="order-page">
      <section className="order-card order-header-card">
        <div>
          <button className="order-btn-secondary" style={{ marginRight: 12 }} onClick={handleClose}>
            ← Back
          </button>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            {isEdit ? "Edit Purchase Order" : "New Purchase Order"}
          </span>
        </div>
      </section>
      {formContent}
    </div>
  );
}

export default PurchaseOrderFormPage;
