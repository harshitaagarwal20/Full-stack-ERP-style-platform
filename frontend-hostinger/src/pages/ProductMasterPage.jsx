import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import { exportRowsToExcel } from "../utils/exportExcel";
import { useIsMobile } from "../hooks/useIsMobile";
import { pickMobileRecent } from "../utils/mobileRecent";
import MobileListCard from "../components/common/MobileListCard";

const emptyProductForm = { product_name: "", category: "", default_unit: "", hsn_code: "", description: "", opening_stock: "" };

const UNCATEGORISED = "__none__";

// Accept the header spellings a plant's own spreadsheet is likely to use rather
// than forcing them to rename columns before they can upload.
const HEADER_ALIASES = {
  product_name: ["product name", "product", "productname", "item", "item name", "name"],
  category:     ["category", "product category", "type", "group"],
  default_unit: ["default unit", "unit", "uom"],
  hsn_code:     ["hsn code", "hsn", "hsn/sac", "hsn code no"],
  description:  ["description", "remarks", "notes", "desc"],
  opening_stock: ["opening stock", "opening_stock", "opening balance", "opening qty", "opening quantity", "stock"]
};

function mapProductRow(row) {
  const mapped = { product_name: "", category: "", default_unit: "", hsn_code: "", description: "", opening_stock: "" };
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const header = String(rawKey || "").trim().toLowerCase();
    const field = Object.keys(HEADER_ALIASES).find((key) => HEADER_ALIASES[key].includes(header));
    if (field) mapped[field] = String(rawValue ?? "").trim();
  }
  return mapped;
}

async function parseExcelToProductRows(file) {
  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default ?? xlsxModule;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const objectRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, blankrows: false });
    const rows = (Array.isArray(objectRows) ? objectRows : [])
      .map(mapProductRow)
      .filter((row) => row.product_name);
    if (rows.length) return rows;
  }

  return [];
}

function ProductMasterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [products, setProducts] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [unitOptions, setUnitOptions] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/master-data");
      setProducts(Array.isArray(data?.productMaster) ? data.productMaster : []);
      setCategoryOptions(Array.isArray(data?.productCategories) ? data.productCategories : []);
      setUnitOptions(Array.isArray(data?.units) ? data.units : []);
    } catch (error) {
      logApiError(error, "Failed to load product master");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const filterOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...categoryOptions,
      { value: UNCATEGORISED, label: "Uncategorised" }
    ],
    [categoryOptions]
  );

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter === UNCATEGORISED && product.category) return false;
      if (categoryFilter && categoryFilter !== UNCATEGORISED && product.category !== categoryFilter) return false;
      if (!query) return true;
      return [product.productName, product.category, product.hsnCode, product.description]
        .some((field) => String(field || "").toLowerCase().includes(query));
    });
  }, [products, searchText, categoryFilter]);

  const isMobile = useIsMobile();
  const displayProducts = useMemo(
    () => pickMobileRecent(filtered, { isMobile, hasSearch: Boolean(searchText.trim() || categoryFilter) }),
    [filtered, isMobile, searchText, categoryFilter]
  );
  const showingRecentOnly = isMobile && !searchText.trim() && !categoryFilter && filtered.length > displayProducts.length;

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyProductForm);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingId(product.id);
    setForm({
      product_name: product.productName || "",
      category: product.category || "",
      default_unit: product.defaultUnit || "",
      hsn_code: product.hsnCode || "",
      description: product.description || ""
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyProductForm);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving || !form.product_name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/master-data/product-master/rows/${editingId}`, form);
        dispatchUserMessage("Product updated.", { title: "Saved", variant: "success" });
      } else {
        await api.post("/master-data/product-master/rows", form);
        dispatchUserMessage("Product added to the master.", { title: "Saved", variant: "success" });
      }
      closeModal();
      await fetchMasterData();
    } catch (error) {
      logApiError(error, editingId ? "Failed to update product" : "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (product) => {
    if (deletingId) return;
    // Retiring a product withdraws it from every product picker, so make the
    // consequence explicit before it happens.
    const confirmed = window.confirm(
      `Retire "${product.productName}"? It will stop being offered on new enquiries and orders. Existing records keep it.`
    );
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      await api.delete(`/master-data/product-master/rows/${product.id}`);
      dispatchUserMessage("Product retired.", { title: "Removed", variant: "success" });
      await fetchMasterData();
    } catch (error) {
      logApiError(error, "Failed to retire product");
    } finally {
      setDeletingId(null);
    }
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const rows = await parseExcelToProductRows(file);
      if (!rows.length) {
        dispatchUserMessage(
          "No products found. The sheet needs a 'Product Name' column; 'Category', 'Description' and 'Opening Stock' are optional.",
          { title: "Import", variant: "error" }
        );
        return;
      }

      const { data } = await api.post("/master-data/product-master/import", { rows });
      dispatchUserMessage(
        `Import complete. Added: ${data.imported}, updated: ${data.updated}, failed: ${data.failed}.`,
        { title: "Import complete", variant: data.failed ? "error" : "success" }
      );
      await fetchMasterData();
    } catch (error) {
      logApiError(error, "Failed to import products");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const exportToExcel = () => {
    const columns = [
      { key: "productName", header: "Product Name" },
      { key: "category",    header: "Category" },
      { key: "description", header: "Description" },
      { key: "openingStock", header: "Opening Stock" }
    ];
    const rows = filtered.map((product) => ({
      productName: product.productName || "-",
      category:    product.category || "-",
      description: product.description || "-",
      openingStock: ""
    }));
    exportRowsToExcel("product-master", columns, rows);
  };

  return (
    <div className="order-page">
      {/* HEADER */}
      <section className="order-card">
        <div className="order-header-card">
          <div className="order-header-left">
            <h2>Product Master</h2>
            <p className="order-header-sub">The product range behind every enquiry, order and production picker.</p>
          </div>
          <div className="order-header-right">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={onImportFile}
            />
            <button
              className="order-btn-secondary"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? "Importing..." : "Import from Excel"}
            </button>
            <button className="order-btn-primary" onClick={openAddModal}>+ Add Product</button>
          </div>
        </div>
      </section>

      {/* SEARCH + FILTERS + ACTIONS */}
      <section className="order-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input autoComplete="off"
            placeholder="Search product, category or HSN..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="unified-filter-row">
          <SearchableSelect
            options={filterOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="All categories"
          />
        </div>

        <div className="unified-actions">
          <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
        </div>
      </section>

      {/* LIST */}
      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="order-skeleton-row" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>{products.length === 0 ? "No products yet" : "No products match these filters"}</p>
            {products.length === 0 && (
              <button className="order-btn-primary" style={{ marginTop: 10 }} onClick={openAddModal}>
                + Add Product
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="order-table-wrap">
              <div className="order-table-meta">
                {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              </div>
              <table className="order-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayProducts.map((product, idx) => (
                    <tr key={product.id}>
                      <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{product.productName}</td>
                      <td>
                        {product.category ? (
                          <span className="order-status approved">{product.category}</span>
                        ) : (
                          <span className="pack-cell-sub">Uncategorised</span>
                        )}
                      </td>
                      <td>{product.description || "-"}</td>
                      <td>
                        <div className="order-row-actions">
                          <button className="order-btn-secondary" onClick={() => openEditModal(product)}>Edit</button>
                          <button
                            className="order-btn-secondary"
                            disabled={deletingId === product.id}
                            onClick={() => onDelete(product)}
                          >
                            {deletingId === product.id ? "Removing..." : "Retire"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isMobile && (
              <div className="order-mobile-list">
                {displayProducts.map((product) => (
                  <MobileListCard
                    key={product.id}
                    title={product.productName}
                    subtitle={product.description || ""}
                    badge={product.category || "Uncategorised"}
                    badgeColor={product.category ? "blue" : "default"}
                    fields={[
                      { label: "Category", value: product.category || "Uncategorised" },
                      { label: "Description", value: product.description || "-" }
                    ]}
                    onActionClick={() => openEditModal(product)}
                    actionLabel="Edit"
                  />
                ))}
                {showingRecentOnly && (
                  <div className="mobile-recent-hint">
                    Showing the 5 most recent. Search to find any product.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {modalOpen && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card" style={{ width: "min(520px, 100%)" }}>
            <div className="masterdata-modal-head">
              <div>
                <h3>{editingId ? "Edit Product" : "Add Product"}</h3>
                <p>Products added here are immediately selectable on enquiries and orders.</p>
              </div>
              <button className="masterdata-modal-close-btn" onClick={closeModal} disabled={saving} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="masterdata-form-grid">
                <div className="full-row">
                  <label className="label">Product Name <span className="req">*</span></label>
                  <input autoComplete="off"
                    className="input"
                    value={form.product_name}
                    onChange={(e) => setForm((p) => ({ ...p, product_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={form.category}
                    onChange={(value) => setForm((p) => ({ ...p, category: value }))}
                    placeholder="Select category"
                    allowCustom
                  />
                  <small style={{ color: "#64748b" }}>Type to add a new category.</small>
                </div>
                <div>
                  <label className="label">Default Unit</label>
                  <SearchableSelect
                    options={unitOptions}
                    value={form.default_unit}
                    onChange={(value) => setForm((p) => ({ ...p, default_unit: value }))}
                    placeholder="Select unit"
                  />
                </div>
                {!editingId && (
                  <div>
                    <label className="label">HSN Code</label>
                    <input autoComplete="off"
                      className="input"
                      value={form.hsn_code}
                      onChange={(e) => setForm((p) => ({ ...p, hsn_code: e.target.value }))}
                    />
                  </div>
                )}
                {/* Opening stock is a one-time starting balance seeded into
                    inventory, so it is offered only when adding a new product —
                    never on edit, where re-saving would double-count it. */}
                {!editingId && (
                  <div>
                    <label className="label">Opening Stock</label>
                    <input autoComplete="off"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={form.opening_stock}
                      onChange={(e) => setForm((p) => ({ ...p, opening_stock: e.target.value }))}
                    />
                    <small style={{ color: "#64748b" }}>
                      Optional. Sets the product's starting inventory balance.
                    </small>
                  </div>
                )}
                <div className="full-row">
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              <div className="masterdata-form-actions" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
                <button type="button" className="masterdata-btn-secondary" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="masterdata-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductMasterPage;
