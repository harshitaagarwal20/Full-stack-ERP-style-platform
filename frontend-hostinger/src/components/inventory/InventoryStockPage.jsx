import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../erp/ErpIcons";
import { logApiError } from "../../utils/apiError";
import { dispatchUserMessage } from "../../utils/errorMessages";
import SearchableSelect from "../common/SearchableSelect";
import Toolbar from "../common/Toolbar";
import useMasterData from "../../hooks/useMasterData";

const emptyAdjustForm = { item_id: "", direction: "IN", quantity: "", reason: "" };
const emptyOpeningForm = { item_id: "", quantity: "", batch_no: "" };

// The stock register can list every material with a carried-forward balance, so
// page it client-side rather than rendering hundreds of rows at once.
const REGISTER_PAGE_SIZE = 25;

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

// One inventory screen shared by Raw Materials, Packing Material and Finished
// Goods — each is the same stock/register/adjust UI scoped to a fixed
// purchasing category (or, for finished goods, to items that have no
// purchasing category at all, since they're produced rather than bought).
function InventoryStockPage({ category, title, emptyHint, catalogKey, materialLabel = "material" }) {
  const masterData = useMasterData();
  const [activeView, setActiveView] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [uomFilter, setUomFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "netQty", direction: "asc" });
  const tableWrapRef = useRef(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [savingAdjust, setSavingAdjust] = useState(false);

  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingForm, setOpeningForm] = useState(emptyOpeningForm);
  const [savingOpening, setSavingOpening] = useState(false);

  const [registerDate, setRegisterDate] = useState(todayIsoDate());
  const [registerRows, setRegisterRows] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerPage, setRegisterPage] = useState(1);
  // Once the user picks a date we stop auto-jumping them to the latest movement.
  const registerDateTouched = useRef(false);

  const fetchRegister = async (date) => {
    setRegisterLoading(true);
    try {
      const { data } = await api.get("/inventory/stock-register", { params: { date, category } });
      setRegisterRows(Array.isArray(data.rows) ? data.rows : []);
      setRegisterPage(1);

      // First open lands on the most recent day that actually had movement, so
      // the screen shows data instead of an empty "today". Only until the user
      // takes over the date picker themselves.
      if (!registerDateTouched.current && data.latestMovementDate && data.latestMovementDate !== date) {
        setRegisterDate(data.latestMovementDate);
      }
    } catch (err) {
      logApiError(err, "Failed to load stock register");
    } finally {
      setRegisterLoading(false);
    }
  };

  // A row counts as movement on the selected day if anything actually flowed —
  // opening/closing balances carried forward are not movement.
  const movedCount = registerRows.filter((row) =>
    row.production || row.dispatch || row.consumeAShift || row.consumeBShift || row.consumeCShift
  ).length;

  const registerTotalPages = Math.max(1, Math.ceil(registerRows.length / REGISTER_PAGE_SIZE));
  const pagedRegisterRows = useMemo(() => {
    const start = (registerPage - 1) * REGISTER_PAGE_SIZE;
    return registerRows.slice(start, start + REGISTER_PAGE_SIZE);
  }, [registerRows, registerPage]);

  // A new date (or refetch) can shrink the list — snap back if the current page
  // no longer exists so the user never lands on an empty page.
  useEffect(() => {
    setRegisterPage((p) => Math.min(p, registerTotalPages));
  }, [registerTotalPages]);

  useEffect(() => {
    if (activeView === "register") fetchRegister(registerDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, registerDate, category]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { category };
      if (search) params.search = search;
      if (uomFilter) params.uom = uomFilter;
      if (gradeFilter) params.grade = gradeFilter;
      const { data } = await api.get("/inventory/raw-materials", { params });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      logApiError(err, `Failed to load ${materialLabel} inventory`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, uomFilter, gradeFilter, category]);

  const uoms = useMemo(
    () => [...new Set(items.map((i) => i.uom).filter(Boolean))].sort(),
    [items]
  );
  const grades = useMemo(
    () => [...new Set(items.map((i) => i.grade).filter(Boolean))].sort(),
    [items]
  );
  const activeFilterCount = [search, uomFilter, gradeFilter].filter(Boolean).length;

  const productOptions = useMemo(() => {
    const options = Array.isArray(masterData[catalogKey]) ? masterData[catalogKey] : [];
    const known = new Set(options.map((option) => option.value));
    const stockOnlyItems = items
      .map((item) => item.itemId)
      .filter((itemId) => itemId && !known.has(itemId));
    const extra = [...new Set(stockOnlyItems)].map((itemId) => ({ value: itemId, label: itemId }));
    return [...options, ...extra];
  }, [masterData, catalogKey, items]);

  // An adjustment is a blind edit to a live balance unless you can see what it
  // does to that balance, so show current → resulting stock as it is typed.
  const adjustPreview = useMemo(() => {
    const stockRow = items.find((item) => item.itemId === adjustForm.item_id);
    const qty = Number(adjustForm.quantity);
    if (!stockRow || !Number.isFinite(qty) || qty <= 0) return null;

    const current = Number(stockRow.netQty || 0);
    const next = adjustForm.direction === "OUT" ? current - qty : current + qty;
    return { current, next, uom: stockRow.uom || "", negative: next < 0 };
  }, [items, adjustForm.item_id, adjustForm.quantity, adjustForm.direction]);

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
    setUomFilter("");
    setGradeFilter("");
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

  const openOpeningModal = () => {
    setOpeningForm(emptyOpeningForm);
    setIsOpeningOpen(true);
  };

  const closeOpeningModal = () => {
    if (savingOpening) return;
    setIsOpeningOpen(false);
  };

  const submitOpeningStock = async (e) => {
    e.preventDefault();
    if (savingOpening) return;
    setSavingOpening(true);
    try {
      await api.post("/inventory/opening-stock", {
        item_id: openingForm.item_id.trim(),
        quantity: Number(openingForm.quantity),
        batch_no: openingForm.batch_no.trim() || undefined
      });
      dispatchUserMessage("Opening stock saved.", { title: "Saved", variant: "success" });
      setIsOpeningOpen(false);
      fetchData();
    } catch (err) {
      logApiError(err, "Failed to save opening stock");
    } finally {
      setSavingOpening(false);
    }
  };

  return (
    <div className="order-page">
      <Toolbar
        title={title}
        search={
          activeView === "stock" && (
            <>
              <SearchIcon />
              <input autoComplete="off"
                placeholder="Search item, category or grade..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearchSubmit();
                }}
              />
            </>
          )
        }
        actions={
          activeView === "stock" && (
            <>
              <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
              <button className="order-btn-secondary" onClick={openOpeningModal}>Add Opening Stock</button>
              <button className="order-btn-secondary" onClick={() => openAdjustModal()}>Adjust Stock</button>
            </>
          )
        }
        filters={
          activeView === "stock" && (
            <>
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

      <section className="order-card order-tabs-card">
        <div className="order-tabs">
          {[{ key: "stock", label: "Current Stock" }, { key: "register", label: "Stock Register" }].map((tab) => (
            <button
              key={tab.key}
              className={`order-tab-btn${activeView === tab.key ? " active" : ""}`}
              onClick={() => setActiveView(tab.key)}
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
            <p style={{ color: "#64748b", marginTop: 6 }}>{emptyHint}</p>
          </div>
        ) : (
          <div className="responsive-table-wrap" ref={tableWrapRef}>
            <div className="order-table-meta">
              {sorted.length} item{sorted.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 ? ` matching ${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""}` : ""}
            </div>
            <table className="order-table responsive-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th><SortBtn col="itemId" label="Product ID / Name" /></th>
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
                    <td data-label="" style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                    <td data-label="Item ID / Name" style={{ fontWeight: 600, color: "#1d4ed8" }}>{item.itemId}</td>
                    <td data-label="Grade">{item.grade || "-"}</td>
                    <td data-label="UOM">{item.uom || "-"}</td>
                    <td data-label="Received" style={{ textAlign: "right" }}>{Number(item.totalIn || 0).toLocaleString()}</td>
                    <td data-label="Consumed" style={{ textAlign: "right" }}>{item.totalOut > 0 ? Number(item.totalOut).toLocaleString() : "-"}</td>
                    <td data-label="Net Stock" style={{ textAlign: "right", fontWeight: 600 }}>{Number(item.netQty || 0).toLocaleString()}</td>
                    <td data-label="Status"><StockBadge netQty={item.netQty || 0} /></td>
                    <td data-label="Warehouse">{item.warehouseLocation || "-"}</td>
                    <td data-label="Last Received">{formatDate(item.lastReceivedAt)}</td>
                    <td data-label="">
                      <button className="adjust-row-btn" onClick={() => openAdjustModal(item.itemId)}>
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
          <section className="order-card rm-register-bar-card">
            <div className="rm-register-bar">
              <div className="rm-register-field">
                <label className="rm-register-label">Date</label>
                <input autoComplete="off" className="input" type="date" value={registerDate} onChange={(e) => { registerDateTouched.current = true; setRegisterDate(e.target.value); }} />
              </div>
              <span className="rm-register-count">
                {movedCount > 0
                  ? `${movedCount} item${movedCount !== 1 ? "s" : ""} moved on this date`
                  : registerRows.length > 0
                    ? `No movement on this date · ${registerRows.length} balance${registerRows.length !== 1 ? "s" : ""} carried forward`
                    : "No movement on this date"}
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
              <div className="responsive-table-wrap">
                <table className="order-table responsive-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>S.NO</th>
                      <th>Name of Item</th>
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
                    {pagedRegisterRows.map((row, idx) => (
                      <tr key={`${row.itemId}-${row.batchNo}-${idx}`}>
                        <td data-label="" style={{ color: "#94a3b8", fontSize: 12 }}>{(registerPage - 1) * REGISTER_PAGE_SIZE + idx + 1}</td>
                        <td data-label="Item" style={{ fontWeight: 600, color: "#1d4ed8" }}>{row.itemId}</td>
                        <td data-label="Batch No.">{row.batchNo || "-"}</td>
                        <td data-label="Grade">{row.grade || "-"}</td>
                        <td data-label="Opening Stock" style={{ textAlign: "right" }}>{Number(row.openingStock || 0).toLocaleString()}</td>
                        <td data-label="Production" style={{ textAlign: "right" }}>{Number(row.production || 0).toLocaleString()}</td>
                        <td data-label="Dispatch" style={{ textAlign: "right" }}>{Number(row.dispatch || 0).toLocaleString()}</td>
                        <td data-label="Consume A-Shift" style={{ textAlign: "right" }}>{Number(row.consumeAShift || 0).toLocaleString()}</td>
                        <td data-label="Consume B-Shift" style={{ textAlign: "right" }}>{Number(row.consumeBShift || 0).toLocaleString()}</td>
                        <td data-label="Consume C-Shift" style={{ textAlign: "right" }}>{Number(row.consumeCShift || 0).toLocaleString()}</td>
                        <td data-label="Closing Stock" style={{ textAlign: "right", fontWeight: 600 }}>{Number(row.closingStock || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {registerTotalPages > 1 && (
                  <div className="order-pagination" style={{ borderTop: "1px solid #f1f5f9" }}>
                    <div className="order-pagination-info">
                      Page {registerPage} of {registerTotalPages} · {registerRows.length} row{registerRows.length !== 1 ? "s" : ""}
                    </div>
                    <div className="order-page-controls">
                      <button onClick={() => setRegisterPage((p) => Math.max(1, p - 1))} disabled={registerPage === 1}>Prev</button>
                      <button onClick={() => setRegisterPage((p) => Math.min(registerTotalPages, p + 1))} disabled={registerPage === registerTotalPages}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {isOpeningOpen && (
        <div className="masterdata-modal-overlay" onClick={closeOpeningModal}>
          <div className="masterdata-modal-card adjust-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adjust-head">
              <div>
                <h3>Add Opening Stock</h3>
                <p className="pack-cell-sub">Sets a {materialLabel}'s starting balance. Pick it from the list so the name always matches.</p>
              </div>
              <button className="adjust-close" onClick={closeOpeningModal} disabled={savingOpening} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={submitOpeningStock}>
              <div className="adjust-body">
                <div className="adjust-field">
                  <label className="label">Material <span className="req">*</span></label>
                  <SearchableSelect
                    options={productOptions}
                    value={openingForm.item_id}
                    onChange={(value) => setOpeningForm((p) => ({ ...p, item_id: value }))}
                    placeholder="Select material"
                  />
                </div>

                <div className="adjust-field">
                  <label className="label">Opening Quantity <span className="req">*</span></label>
                  <input
                    autoComplete="off"
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={openingForm.quantity}
                    onChange={(e) => setOpeningForm((p) => ({ ...p, quantity: e.target.value }))}
                    required
                  />
                </div>

                <div className="adjust-field">
                  <label className="label">Batch No <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    autoComplete="off"
                    className="input"
                    placeholder="Leave blank for a single un-batched balance"
                    value={openingForm.batch_no}
                    onChange={(e) => setOpeningForm((p) => ({ ...p, batch_no: e.target.value }))}
                  />
                </div>
              </div>

              <div className="adjust-actions">
                <button type="button" className="order-btn-secondary" onClick={closeOpeningModal} disabled={savingOpening}>Cancel</button>
                <button type="submit" className="order-btn-primary" disabled={savingOpening || !openingForm.item_id || openingForm.quantity === ""}>
                  {savingOpening ? "Saving..." : "Save Opening Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdjustOpen && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card adjust-modal">
            <div className="adjust-head">
              <div>
                <h3>Adjust Stock</h3>
              </div>
              <button className="adjust-close" onClick={closeAdjustModal} disabled={savingAdjust} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={submitAdjustment}>
              <div className="adjust-body">
                <div className="adjust-field">
                  <label className="label">Product ID / Name <span className="req">*</span></label>
                  <SearchableSelect
                    options={productOptions}
                    value={adjustForm.item_id}
                    onChange={(value) => setAdjustForm((p) => ({ ...p, item_id: value }))}
                    placeholder="Select product"
                  />
                </div>

                {/* Add vs. remove is the decision that inverts the whole record —
                    a two-way choice buried in a dropdown is too easy to get wrong. */}
                <div className="adjust-field">
                  <label className="label">Direction <span className="req">*</span></label>
                  <div className="adjust-toggle">
                    <button
                      type="button"
                      className={`adjust-toggle-btn in${adjustForm.direction === "IN" ? " active" : ""}`}
                      onClick={() => setAdjustForm((p) => ({ ...p, direction: "IN" }))}
                    >
                      + Add to stock
                    </button>
                    <button
                      type="button"
                      className={`adjust-toggle-btn out${adjustForm.direction === "OUT" ? " active" : ""}`}
                      onClick={() => setAdjustForm((p) => ({ ...p, direction: "OUT" }))}
                    >
                      − Remove from stock
                    </button>
                  </div>
                </div>

                <div className="adjust-field">
                  <label className="label">Quantity <span className="req">*</span></label>
                  <input autoComplete="off"
                    className="input"
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="0"
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm((p) => ({ ...p, quantity: e.target.value }))}
                    required
                  />
                </div>

                {adjustPreview && (
                  <div className={`adjust-preview${adjustPreview.negative ? " negative" : ""}`}>
                    <div>
                      <span>Current stock</span>
                      <strong>{adjustPreview.current.toLocaleString()} {adjustPreview.uom}</strong>
                    </div>
                    <span className="adjust-preview-arrow">→</span>
                    <div>
                      <span>After adjustment</span>
                      <strong>{adjustPreview.next.toLocaleString()} {adjustPreview.uom}</strong>
                    </div>
                    {adjustPreview.negative && (
                      <p className="adjust-preview-warn">
                        This removes more than is in stock and would take the balance negative.
                      </p>
                    )}
                  </div>
                )}

                <div className="adjust-field">
                  <label className="label">Reason <span className="req">*</span></label>
                  <input autoComplete="off"
                    className="input"
                    placeholder="e.g. Damaged in storage, stock-take correction..."
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                    minLength={3}
                    required
                  />
                </div>
              </div>

              <div className="adjust-actions">
                <button type="button" className="masterdata-btn-secondary" onClick={closeAdjustModal} disabled={savingAdjust}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`masterdata-btn-primary${adjustForm.direction === "OUT" ? " danger" : ""}`}
                  disabled={savingAdjust}
                >
                  {savingAdjust ? "Saving..." : adjustForm.direction === "OUT" ? "Remove Stock" : "Add Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryStockPage;
