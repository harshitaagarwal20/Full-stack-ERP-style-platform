import { useMemo, useState } from "react";
import { SearchIcon } from "../erp/ErpIcons";
import { getStatusLabel } from "../../utils/productionMfg";

// Modal that lets the operator pick which production batch to log against,
// so the standalone list pages (Operation Log, In-Process Testing, QC) can
// start a new entry without first drilling into a record.
function ProductionBatchPicker({ records, title, onPick, onClose }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => {
      const haystack = [
        record.batchNo,
        record.order?.orderNo,
        record.order?.product,
        record.order?.clientName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [records, query]);

  return (
    <div className="order-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="order-modal-card">
        <div className="order-modal-head">
          <div>
            <h3>{title}</h3>
            <p>Pick the batch you want to log against.</p>
          </div>
          <button className="order-modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <div className="unified-search-box">
          <SearchIcon />
          <input autoComplete="off"
            autoFocus
            placeholder="Search batch, order, client or product..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {matches.length === 0 ? (
          <p style={{ margin: "16px 0 0", color: "#64748b", fontSize: 13 }}>
            No batches match that search.
          </p>
        ) : (
          <div className="batch-picker-list">
            {matches.map((record) => (
              <button
                key={record.id}
                type="button"
                className="batch-picker-row"
                onClick={() => onPick(record)}
              >
                <span className="batch-picker-code">{record.batchNo || "No batch no."}</span>
                <span className="batch-picker-name">{record.order?.product || "-"}</span>
                <span className="batch-picker-meta">
                  {record.order?.clientName || "-"} · {getStatusLabel(record.status)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductionBatchPicker;
