import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import Toolbar from "../components/common/Toolbar";
import useMasterData from "../hooks/useMasterData";

const emptyAdjustForm = { item_id: "", direction: "IN", quantity: "", reason: "" };

function normalizeImportRowValue(value) {
  return String(value ?? "").trim();
}

function normalizeImportRow(row) {
  const itemId = normalizeImportRowValue(row.item_id ?? row["Item Id"] ?? row["Item ID"] ?? row.itemId ?? row.name ?? row.Name);
  const quantityRaw = row.quantity ?? row.Quantity ?? row.qty ?? row.Qty;
  return {
    item_id:  itemId,
    category: normalizeImportRowValue(row.category ?? row.Category) || undefined,
    uom:      normalizeImportRowValue(row.uom ?? row.UOM ?? row.Unit) || undefined,
    grade:    normalizeImportRowValue(row.grade ?? row.Grade) || undefined,
    batch_no: normalizeImportRowValue(row.batch_no ?? row["Batch No"] ?? row.batchNo) || undefined,
    quantity: Number(quantityRaw)
  };
}

async function parseExcelToInventoryRows(file) {
  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default ?? xlsxModule;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const objectRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, blankrows: false });
  return objectRows
    .map(normalizeImportRow)
    .filter((row) => row.item_id && Number.isFinite(row.quantity) && row.quantity >= 0);
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function StockBadge({ netQty }) {
  if (netQty <= 0) return <span className="order-status dispatched">Out of Stock</span>;
  if (netQty < 100) return <span className="order-status partial">Low Stock</span>;
  return <span className="order-status approved">In Stock</span>;
}

function RawMaterialPage() {
  const masterData = useMasterData();
  const [activeView, setActiveView] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [uomFilter, setUomFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "netQty", direction: "asc" });
  const tableWrapRef = useRef(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [importing, setImporting] = useState(false);

  const [registerDate, setRegisterDate] = useState(todayIsoDate());
  const [registerRows, setRegisterRows] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);

  const fetchRegister = async (date) => {
    setRegisterLoading(true);
    try {
      const { data } = await api.get("/inventory/stock-register", { params: { date } });
      setRegisterRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      logApiError(err, "Failed to load stock register");
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === "register") fetchRegister(registerDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, registerDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (uomFilter) params.uom = uomFilter;
      if (gradeFilter) params.grade = gradeFilter;
      const { data } = await api.get("/inventory/raw-materials", { params });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      logApiError(err, "Failed to load raw material inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, categoryFilter, uomFilter, gradeFilter]);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );
  const uoms = useMemo(
    () => [...new Set(items.map((i) => i.uom).filter(Boolean))].sort(),
    [items]
  );
  const grades = useMemo(
    () => [...new Set(items.map((i) => i.grade).filter(Boolean))].sort(),
    [items]
  );
  const activeFilterCount = [search, categoryFilter, uomFilter, gradeFilter].filter(Boolean).length;

  const productOptions = useMemo(() => {
    const options = Array.isArray(masterData.products) ? masterData.products : [];
    const known = new Set(options.map((option) => option.value));
    const stockOnlyItems = items
      .map((item) => item.itemId)
      .filter((itemId) => itemId && !known.has(itemId));
    const extra = [...new Set(stockOnlyItems)].map((itemId) => ({ value: itemId, label: itemId }));
    return [...options, ...extra];
  }, [masterData.products, items]);

  const sorted = useMemo(() => {
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = a[key] ?? "";
      const vb = b[key] ?? "";
      if (typeof va === "number") return (va - vb) * sign;
      return String(va).localeCompare(String(vb)) * sign;
    });
  }, [items, sortConfig]);

  const onSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const SortBtn = ({ col, label, alignRight = false }) => (
    <button
      className="order-sort-btn"
      onClick={() => onSort(col)}
      style={alignRight ? { justifyContent: "flex-end" } : undefined}
    >
      {label}
      {sortConfig.key === col && (
        <span style={{ marginLeft: 4, opacity: 0.6 }}>
          {sortConfig.direction === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );

  const onSearchSubmit = () => {
    setSearch(searchText.trim());
  };

  const clearFilters = () => {
    setSearch("");
    setSearchText("");
    setCategoryFilter("");
    setUomFilter("");
    setGradeFilter("");
  };

  const onImportFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const rows = await parseExcelToInventoryRows(file);
      if (!rows.length) {
        dispatchUserMessage("No valid rows found in the file.", { title: "Import", variant: "error" });
        return;
      }

      const { data } = await api.post("/inventory/import", { rows });
      dispatchUserMessage(
        `Opening stock import complete. Imported: ${data.imported}, unchanged: ${data.skipped}, failed: ${data.failed}.`,
        { title: "Import complete", variant: data.failed ? "error" : "success" }
      );
      fetchData();
    } catch (err) {
      logApiError(err, "Failed to import inventory opening stock");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const openAdjustModal = (itemId = "") => {
    setAdjustForm({ ...emptyAdjustForm, item_id: itemId });
    setIsAdjustOpen(true);
  };

  const closeAdjustModal = () => {
    if (savingAdjust) return;
    setIsAdjustOpen(false);
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    setSavingAdjust(true);
    try {
      await api.post("/inventory/adjustments", {
        item_id: adjustForm.item_id.trim(),
        direction: adjustForm.direction,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason.trim()
      });
      dispatchUserMessage("Stock adjustment recorded.", { title: "Saved", variant: "success" });
      setIsAdjustOpen(false);
      fetchData();
    } catch (err) {
      logApiError(err, "Failed to record stock adjustment");
    } finally {
      setSavingAdjust(false);
    }
  };

  return (
    <div className="order-page">
      <Toolbar
        title="Raw Material Inventory"
        search={
          activeView === "stock" && (
            <div className="ui-toolbar-search">
              <SearchIcon />
              <input
                placeholder="Search item, category or grade..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearchSubmit();
                }}
              />
            </div>
          )
        }
        actions={
          activeView === "stock" && (
            <>
              <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
              <button className="order-btn-secondary" onClick={() => openAdjustModal()}>Adjust Stock</button>
              <label className="order-btn-secondary" style={{ cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1 }}>
                {importing ? "Importing..." : "Import Opening Stock (Excel)"}
                <input
                  type="file"
                  accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={onImportFileSelected}
                  disabled={importing}
                  style={{ display: "none" }}
                />
              </label>
            </>
          )
        }
        filters={
          activeView === "stock" && (
            <>
              <SearchableSelect
                options={categories.map((c) => ({ value: c, label: c }))}
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                placeholder="All Categories"
              />
              <SearchableSelect
                options={uoms.map((u) => ({ value: u, label: u }))}
                value={uomFilter}
                onChange={(value) => setUomFilter(value)}
                placeholder="All UOM"
              />
              <SearchableSelect
                options={grades.map((g) => ({ value: g, label: g }))}
                value={gradeFilter}
                onChange={(value) => setGradeFilter(value)}
                placeholder="All Grades"
              />
              {activeFilterCount > 0 && (
                <button className="order-btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </>
          )
        }
      />

      <section className="order-card" style={{ padding: 0 }}>
        <div style={{ display: "flex", gap: "2px", borderBottom: "2px solid #e2e8f0" }}>
          {[{ key: "stock", label: "Current Stock" }, { key: "register", label: "Stock Register" }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              style={{
                padding: "10px 18px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: activeView === tab.key ? "700" : "400",
                color: activeView === tab.key ? "#1e293b" : "#64748b",
                borderBottom: activeView === tab.key ? "2px solid #1e293b" : "2px solid transparent",
                marginBottom: "-2px"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "stock" && (
      <>
      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="order-skeleton-row" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>No inventory records yet</p>
            <p style={{ color: "#64748b", marginTop: 6 }}>Confirm a GRN to see raw material stock appear here.</p>
          </div>
        ) : (
          <div className="order-table-wrap" ref={tableWrapRef}>
            <div className="order-table-meta">
              {sorted.length} item{sorted.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 ? ` matching ${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""}` : ""}
            </div>
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th><SortBtn col="itemId" label="Product ID / Name" /></th>
                  <th><SortBtn col="category" label="Category" /></th>
                  <th><SortBtn col="grade" label="Grade" /></th>
                  <th>UOM</th>
                  <th style={{ textAlign: "right" }}><SortBtn col="totalIn" label="Received" alignRight /></th>
                  <th style={{ textAlign: "right" }}><SortBtn col="totalOut" label="Consumed" alignRight /></th>
                  <th style={{ textAlign: "right" }}><SortBtn col="netQty" label="Net Stock" alignRight /></th>
                  <th>Status</th>
                  <th>Warehouse</th>
                  <th><SortBtn col="lastReceivedAt" label="Last Received" /></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, idx) => (
                  <tr
                    key={`${item.itemId}-${idx}`}
                    style={{
                      cursor: "default",
                      background: item.netQty <= 0 ? "#fff1f2" : item.netQty < 100 ? "#fffbeb" : undefined
                    }}
                  >
                    <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{item.itemId}</td>
                    <td>{item.category || "-"}</td>
                    <td>{item.grade || "-"}</td>
                    <td>{item.uom || "-"}</td>
                    <td style={{ textAlign: "right" }}>{Number(item.totalIn || 0).toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>{item.totalOut > 0 ? Number(item.totalOut).toLocaleString() : "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(item.netQty || 0).toLocaleString()}</td>
                    <td><StockBadge netQty={item.netQty || 0} /></td>
                    <td>{item.warehouseLocation || "-"}</td>
                    <td>{formatDate(item.lastReceivedAt)}</td>
                    <td>
                      <button className="order-sort-btn" onClick={() => openAdjustModal(item.itemId)}>
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </>
      )}

      {activeView === "register" && (
        <>
          <section className="order-card" style={{ padding: "12px 20px" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <label className="label" style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Date</label>
                <input className="input" type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} />
              </div>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
                {registerRows.length} item{registerRows.length !== 1 ? "s" : ""} moved on this date
              </span>
            </div>
          </section>

          <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
            {registerLoading ? (
              <div className="order-skeleton-list" style={{ padding: 20 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="order-skeleton-row" />
                ))}
              </div>
            ) : registerRows.length === 0 ? (
              <div className="order-empty-state">
                <div className="order-empty-icon"><BoxesIcon /></div>
                <p>No stock movement recorded for this date</p>
              </div>
            ) : (
              <div className="order-table-wrap">
                <table className="order-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>S.NO</th>
                      <th>Name of Raw Material</th>
                      <th>Batch No.</th>
                      <th>Grade</th>
                      <th style={{ textAlign: "right" }}>Opening Stock</th>
                      <th style={{ textAlign: "right" }}>Production</th>
                      <th style={{ textAlign: "right" }}>Dispatch</th>
                      <th style={{ textAlign: "right" }}>Consume A-Shift</th>
                      <th style={{ textAlign: "right" }}>Consume B-Shift</th>
                      <th style={{ textAlign: "right" }}>Consume C-Shift</th>
                      <th style={{ textAlign: "right" }}>Closing Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registerRows.map((row, idx) => (
                      <tr key={`${row.itemId}-${row.batchNo}-${idx}`}>
                        <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{row.itemId}</td>
                        <td>{row.batchNo || "-"}</td>
                        <td>{row.grade || "-"}</td>
                        <td style={{ textAlign: "right" }}>{Number(row.openingStock || 0).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{Number(row.production || 0).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{Number(row.dispatch || 0).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{Number(row.consumeAShift || 0).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{Number(row.consumeBShift || 0).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{Number(row.consumeCShift || 0).toLocaleString()}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(row.closingStock || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {isAdjustOpen && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card" style={{ width: "min(480px, 100%)" }}>
            <div className="masterdata-modal-head">
              <div>
                <h3>Adjust Stock</h3>
                <p>Correct raw material stock for wastage, damage, or a physical count mismatch.</p>
              </div>
              <button className="masterdata-modal-close-btn" onClick={closeAdjustModal} disabled={savingAdjust} type="button">
                X Close
              </button>
            </div>

            <form onSubmit={submitAdjustment}>
              <div className="masterdata-form-grid">
                <div>
                  <label className="label">Product ID / Name <span className="req">*</span></label>
                  <SearchableSelect
                    options={productOptions}
                    value={adjustForm.item_id}
                    onChange={(value) => setAdjustForm((p) => ({ ...p, item_id: value }))}
                    placeholder="Select product"
                  />
                </div>
                <div>
                  <label className="label">Direction <span className="req">*</span></label>
                  <SearchableSelect
                    options={[
                      { value: "IN", label: "Add to stock (+)" },
                      { value: "OUT", label: "Remove from stock (-)" }
                    ]}
                    value={adjustForm.direction}
                    onChange={(value) => setAdjustForm((p) => ({ ...p, direction: value }))}
                    placeholder="Select direction"
                  />
                </div>
                <div>
                  <label className="label">Quantity <span className="req">*</span></label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm((p) => ({ ...p, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Reason <span className="req">*</span></label>
                  <input
                    className="input"
                    placeholder="e.g. Damaged in storage, stock-take correction..."
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                    minLength={3}
                    required
                  />
                </div>
              </div>

              <div className="masterdata-form-actions" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
                <button type="button" className="masterdata-btn-secondary" onClick={closeAdjustModal} disabled={savingAdjust}>
                  Cancel
                </button>
                <button type="submit" className="masterdata-btn-primary" disabled={savingAdjust}>
                  {savingAdjust ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RawMaterialPage;
