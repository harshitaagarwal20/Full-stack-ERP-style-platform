import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";
import { getDisplaySalesNumber } from "../utils/businessNumbers";

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function calculateBatchTracking(rows) {
  const cumulativeByGroup = new Map();

  return rows.map((row) => {
    const groupKey = `${row.sales_order_no}__${row.product}`;
    const previousCumulative = cumulativeByGroup.get(groupKey) || 0;
    const producedQty = toPositiveNumber(row.produced_qty);
    const cumulativeProduced = previousCumulative + producedQty;
    const totalQty = toPositiveNumber(row.total_qty);
    const remainingQty = Math.max(totalQty - cumulativeProduced, 0);

    let batchStatus = "In Progress";
    if (cumulativeProduced > totalQty) {
      batchStatus = "Overproduction";
    } else if (cumulativeProduced === totalQty && totalQty > 0) {
      batchStatus = "Completed";
    }

    cumulativeByGroup.set(groupKey, cumulativeProduced);

    return {
      sales_order_no: row.sales_order_no || "",
      batch_no: row.batch_no || "",
      produced_qty: producedQty,
      cumulative_produced: cumulativeProduced,
      remaining_qty: remainingQty,
      batch_status: batchStatus
    };
  });
}

function ProductionCompletePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    completion_date: "",
    notes: ""
  });
  const [batchRows, setBatchRows] = useState([]);
  const canManageProduction = ["admin", "production"].includes(user?.role);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/production");
        const found = (data || []).find((item) => String(item.id) === String(id));
        setRecord(found || null);
        if (found?.order) {
          setBatchRows([{
            sales_order_no: getDisplaySalesNumber(found.order) || "",
            product: found.order.product || found.order?.enquiry?.product || "",
            total_qty: Number(found.order.quantity || 0),
            batch_no: "B1",
            produced_qty: ""
          }]);
        }
      } catch (error) {
        logApiError(error, "Failed to load production record");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const trackedRows = useMemo(() => calculateBatchTracking(batchRows), [batchRows]);
  const totalProduced = trackedRows.length ? trackedRows[trackedRows.length - 1].cumulative_produced : 0;
  const hasOverproduction = trackedRows.some((row) => row.batch_status === "Overproduction");

  const onBatchChange = (index, key, value) => {
    setBatchRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const addBatchRow = () => {
    if (!record?.order) return;
    setBatchRows((prev) => ([
      ...prev,
      {
        sales_order_no: getDisplaySalesNumber(record.order) || "",
        product: record.order.product || record.order?.enquiry?.product || "",
        total_qty: Number(record.order.quantity || 0),
        batch_no: `B${prev.length + 1}`,
        produced_qty: ""
      }
    ]));
  };

  const removeBatchRow = (index) => {
    setBatchRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    event.preventDefault();
    if (!record || !canManageProduction) return;
    setSaving(true);
    try {
      await api.put(`/production/${record.id}/edit`, {
        remarks: [
          record.remarks || "",
          `Completed Quantity: ${totalProduced || "-"}`,
          `Completion Date: ${form.completion_date || "-"}`,
          `Batch Tracking: ${JSON.stringify(trackedRows)}`,
          `Notes: ${form.notes || "-"}`
        ].filter(Boolean).join(" | ")
      });
      await api.put(`/production/${record.id}`, {
        completion_date: form.completion_date
      });
      navigate("/production");
    } catch (error) {
      logApiError(error, "Failed to complete production");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mapp-skeleton-card" />;
  if (!record) return <p className="mapp-inline-note">Production record not found.</p>;

  return (
    <div className="mapp-module">
      <div className="mapp-section-head">
        <h2>Complete Production</h2>
      </div>

      <div className="mapp-card">
        <p><strong>Order:</strong> {record.order?.orderNo}</p>
        <p><strong>Sales ID:</strong> {getDisplaySalesNumber(record.order) || "-"}</p>
        <p><strong>Product:</strong> {record.order?.product || record.order?.enquiry?.product}</p>
        <p><strong>Grade / QUANTITY:</strong> {record.order?.grade || "-"} / {record.order?.quantity || 0}</p>
        <p><strong>Assigned:</strong> {record.assignedPersonnel}</p>
      </div>

      {canManageProduction ? (
        <form className="mapp-form" onSubmit={onSubmit}>
          <div className="production-table-wrap">
            <table className="production-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sales ID</th>
                  <th>Product</th>
                  <th>Batch No</th>
                  <th>Produced Quantity</th>
                  <th>Cumulative Produced</th>
                  <th>Remaining Quantity</th>
                  <th>Batch Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row, index) => {
                  const tracked = trackedRows[index] || {};
                  return (
                    <tr key={`${row.batch_no}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.sales_order_no}</td>
                      <td>{row.product}</td>
                      <td>
                        <input
                          value={row.batch_no}
                          onChange={(event) => onBatchChange(index, "batch_no", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.produced_qty}
                          onChange={(event) => onBatchChange(index, "produced_qty", event.target.value)}
                        />
                      </td>
                      <td>{tracked.cumulative_produced ?? 0}</td>
                      <td>{tracked.remaining_qty ?? 0}</td>
                      <td>
                        <span className={`production-status ${tracked.batch_status === "Overproduction" ? "pending" : tracked.batch_status === "Completed" ? "completed" : "in-progress"}`}>
                          {tracked.batch_status || "In Progress"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="production-link-btn delete"
                          onClick={() => removeBatchRow(index)}
                          disabled={batchRows.length <= 1}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="mapp-btn mapp-btn-secondary" onClick={addBatchRow}>Add Batch Row</button>
          <p className="mapp-inline-note">
            Total Produced: <strong>{totalProduced}</strong> | Remaining: <strong>{trackedRows.length ? trackedRows[trackedRows.length - 1].remaining_qty : (record.order?.quantity || 0)}</strong>
            {hasOverproduction ? " | Overproduction detected." : ""}
          </p>
          <label>Completion Date</label>
          <input type="date" value={form.completion_date} onChange={(event) => setForm((prev) => ({ ...prev, completion_date: event.target.value }))} required />
          <label>Notes</label>
          <textarea rows="3" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <label>Output</label>
          <textarea
            rows="8"
            readOnly
            value={JSON.stringify(trackedRows, null, 2)}
          />
          <button className="mapp-btn mapp-btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Mark as Completed"}
          </button>
        </form>
      ) : (
        <div className="mapp-card">
          <p className="mapp-inline-note">This screen is view-only for your role.</p>
        </div>
      )}
    </div>
  );
}

export default ProductionCompletePage;
