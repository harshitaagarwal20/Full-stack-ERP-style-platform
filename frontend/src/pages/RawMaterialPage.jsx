import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function StockBadge({ netQty }) {
  if (netQty <= 0) return <span className="order-status dispatched">Out of Stock</span>;
  if (netQty < 100) return <span className="order-status partial">Low Stock</span>;
  return <span className="order-status approved">In Stock</span>;
}

function RawMaterialPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "netQty", direction: "asc" });
  const tableWrapRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
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
  }, [search, categoryFilter]);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );

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
  };

  return (
    <div className="order-page">
      <section className="order-card order-header-card">
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          Raw Material Inventory
        </h2>
        <div className="order-header-right">
          <div className="order-header-search">
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
          <button className="order-btn-primary" onClick={onSearchSubmit}>
            Search
          </button>
        </div>
      </section>

      <section className="order-card" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input"
            style={{ minWidth: 160, maxWidth: 220 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {(search || categoryFilter) && (
            <button className="order-btn-secondary" onClick={clearFilters}>
              Clear
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
            {sorted.length} item{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
      </section>

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
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th><SortBtn col="itemId" label="Item ID / Name" /></th>
                  <th><SortBtn col="category" label="Category" /></th>
                  <th><SortBtn col="grade" label="Grade" /></th>
                  <th>UOM</th>
                  <th style={{ textAlign: "right" }}><SortBtn col="totalIn" label="Received" alignRight /></th>
                  <th style={{ textAlign: "right" }}><SortBtn col="totalOut" label="Consumed" alignRight /></th>
                  <th style={{ textAlign: "right" }}><SortBtn col="netQty" label="Net Stock" alignRight /></th>
                  <th>Status</th>
                  <th>Warehouse</th>
                  <th><SortBtn col="lastReceivedAt" label="Last Received" /></th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default RawMaterialPage;
