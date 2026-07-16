import { useMemo, useState } from "react";
import api from "../../api/axiosClient";
import { logApiError } from "../../utils/apiError";
import SearchableSelect from "../common/SearchableSelect";

// Human labels for the option lists an admin may maintain. The server decides
// which categories are editable (GET /master-data/editable-categories); this is
// only how we name them on screen, so a category the server adds later still
// shows up — just under its raw key until it is named here.
const CATEGORY_LABELS = {
  products: "Products",
  finishedGoodsCatalog: "Finished Goods",
  rawMaterialsCatalog: "Raw Materials",
  packingMaterialsCatalog: "Packing Materials",
  assignedPersons: "Assigned Persons (Sales)",
  supervisors: "Supervisors (Production)",
  modeOfEnquiry: "Mode of Enquiry",
  units: "Units of Measurement",
  countryCodes: "Country Codes"
};

// Where each list actually shows up, so an admin can see what a change affects
// before they make it.
const CATEGORY_HINTS = {
  products: "Product dropdown on the Enquiry form. An enquiry can only be saved with a product from this list.",
  finishedGoodsCatalog: "Finished-goods pickers on Enquiries, Packing and Dispatch.",
  rawMaterialsCatalog: "Material pickers on the production batch card and purchase orders.",
  packingMaterialsCatalog: "Packing material dropdown on the Packing screen.",
  assignedPersons: "Assigned Person dropdown on Enquiries.",
  supervisors: "Supervisor dropdown on production records.",
  modeOfEnquiry: "Mode of Enquiry dropdown on the Enquiry form.",
  units: "Unit of Measurement dropdown on Enquiries, Orders and Production.",
  countryCodes: "Country Code dropdown on Orders and customer addresses."
};

function labelFor(category) {
  return CATEGORY_LABELS[category] || category;
}

function MasterDataOptionLists({ masterData, editableCategories, loading, onChanged }) {
  const categories = useMemo(
    () => (Array.isArray(editableCategories) ? editableCategories : []),
    [editableCategories]
  );

  const [activeCategory, setActiveCategory] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingValue, setDeletingValue] = useState("");
  const [search, setSearch] = useState("");

  // Default to the first category the server says is editable, rather than
  // assuming "products" exists.
  const selectedCategory = activeCategory || categories[0] || "";

  const values = useMemo(() => {
    const rows = masterData?.[selectedCategory];
    if (!Array.isArray(rows)) return [];
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        String(row.value || "").toLowerCase().includes(query) ||
        String(row.label || "").toLowerCase().includes(query)
    );
  }, [masterData, selectedCategory, search]);

  const addValue = async (event) => {
    event.preventDefault();
    const value = newValue.trim();
    if (!value || !selectedCategory) return;

    setSaving(true);
    try {
      await api.post(`/master-data/${selectedCategory}`, { value });
      setNewValue("");
      await onChanged();
    } catch (error) {
      logApiError(error, `Failed to add "${value}" to ${labelFor(selectedCategory)}`);
    } finally {
      setSaving(false);
    }
  };

  const removeValue = async (value) => {
    if (!window.confirm(
      `Remove "${value}" from ${labelFor(selectedCategory)}?\n\n` +
      "It will stop appearing in dropdowns for new entries. Records already saved against it are not changed."
    )) {
      return;
    }

    setDeletingValue(value);
    try {
      await api.delete(`/master-data/${selectedCategory}/values/${encodeURIComponent(value)}`);
      await onChanged();
    } catch (error) {
      logApiError(error, `Failed to remove "${value}"`);
    } finally {
      setDeletingValue("");
    }
  };

  if (!categories.length) {
    return null;
  }

  return (
    <section className="masterdata-card">
      <div className="masterdata-card-head">
        <div>
          <h3>Dropdown Masters</h3>
          <p>
            Maintain the lists that populate dropdowns across the app. Changes take effect
            immediately for new entries.
          </p>
        </div>
      </div>

      <div className="masterdata-options-toolbar">
        <div className="masterdata-options-field">
          <label>List</label>
          <SearchableSelect
            options={categories.map((category) => ({ value: category, label: labelFor(category) }))}
            value={selectedCategory}
            onChange={(value) => {
              setActiveCategory(value);
              setSearch("");
              setNewValue("");
            }}
            placeholder="Select a list"
          />
        </div>

        <form className="masterdata-options-field grow" onSubmit={addValue}>
          <label>Add a value to {labelFor(selectedCategory)}</label>
          <div className="masterdata-options-add">
            <input autoComplete="off"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              placeholder={`New ${labelFor(selectedCategory).replace(/s$/, "").toLowerCase()}`}
              disabled={saving}
            />
            <button type="submit" className="masterdata-btn-primary" disabled={saving || !newValue.trim()}>
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </form>

        <div className="masterdata-options-field">
          <label>Search</label>
          <input autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter values"
          />
        </div>
      </div>

      {CATEGORY_HINTS[selectedCategory] && (
        <p className="masterdata-options-hint">Used by: {CATEGORY_HINTS[selectedCategory]}</p>
      )}

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading...</p>
      ) : values.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          {search.trim() ? "No values match your search." : "This list is empty. Add the first value above."}
        </p>
      ) : (
        <ul className="masterdata-options-list">
          {values.map((row) => (
            <li key={row.value} className="masterdata-options-item">
              <span>{row.label || row.value}</span>
              <button
                type="button"
                className="masterdata-options-remove"
                onClick={() => removeValue(row.value)}
                disabled={deletingValue === row.value}
                aria-label={`Remove ${row.value}`}
                title="Remove from dropdowns"
              >
                {deletingValue === row.value ? "..." : "✕"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MasterDataOptionLists;
