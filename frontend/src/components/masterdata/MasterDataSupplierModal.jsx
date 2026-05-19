function MasterDataSupplierModal({
  isOpen,
  saving,
  editingSupplierCode,
  supplierForm,
  formErrors,
  stateOptions,
  countryOptions,
  onFieldChange,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null;

  const getInputClassName = (fieldName) => `input ${formErrors[fieldName] ? "input-error" : ""}`;

  return (
    <div className="masterdata-modal-overlay">
      <div className="masterdata-modal-card">
        <div className="masterdata-modal-head">
          <div>
            <h3>{editingSupplierCode ? "Update Supplier" : "Add New Supplier"}</h3>
            <p>
              {editingSupplierCode
                ? `Updating supplier code: ${editingSupplierCode}`
                : "Fill in supplier details. Required fields are marked with *"}
            </p>
          </div>
          <button
            className="masterdata-modal-close"
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            X Close
          </button>
        </div>

        <form className="masterdata-customer-form" onSubmit={onSubmit}>
          <section className="masterdata-form-section">
            <h4>Basic Information</h4>
            <div className="masterdata-form-grid-two">
              <div className="full-row">
                <label className="label">Supplier Name <span className="req">*</span></label>
                <input
                  className={getInputClassName("supplier_name")}
                  placeholder="Enter supplier name"
                  value={supplierForm.supplier_name}
                  onChange={(e) => onFieldChange("supplier_name", e.target.value)}
                  required
                />
                {formErrors.supplier_name ? <small style={{ color: "#dc2626" }}>{formErrors.supplier_name}</small> : null}
              </div>
            </div>
          </section>

          <section className="masterdata-form-section">
            <h4>Location Details</h4>
            <div className="masterdata-form-grid-two">
              <div>
                <label className="label">Country</label>
                <select
                  className={getInputClassName("country")}
                  value={supplierForm.country}
                  onChange={(e) => {
                    const selectedCountry = e.target.value;
                    onFieldChange("country", selectedCountry);
                    const matching = countryOptions.find((item) => item.value === selectedCountry);
                    if (matching) onFieldChange("country_code", matching.code);
                  }}
                >
                  <option value="">Select country</option>
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">State</label>
                <select
                  className={getInputClassName("state")}
                  value={supplierForm.state}
                  onChange={(e) => onFieldChange("state", e.target.value)}
                >
                  <option value="">Select state</option>
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">City</label>
                <input
                  className={getInputClassName("city")}
                  placeholder="Enter city"
                  value={supplierForm.city}
                  onChange={(e) => onFieldChange("city", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input
                  className={getInputClassName("pincode")}
                  placeholder="Enter pincode"
                  value={supplierForm.pincode}
                  onChange={(e) => onFieldChange("pincode", e.target.value)}
                />
              </div>
              <div className="full-row">
                <label className="label">Address</label>
                <input
                  className={getInputClassName("address")}
                  placeholder="Enter full address"
                  value={supplierForm.address}
                  onChange={(e) => onFieldChange("address", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="masterdata-form-section">
            <h4>Business Details</h4>
            <div className="masterdata-form-grid-two">
              <div>
                <label className="label">GSTN</label>
                <input
                  className={getInputClassName("gstn")}
                  placeholder="Enter GSTN"
                  value={supplierForm.gstn}
                  onChange={(e) => onFieldChange("gstn", e.target.value)}
                />
              </div>
              <div>
                <label className="label">PAN No</label>
                <input
                  className={getInputClassName("pan_no")}
                  placeholder="Enter PAN number"
                  value={supplierForm.pan_no}
                  onChange={(e) => onFieldChange("pan_no", e.target.value)}
                />
              </div>
            </div>
          </section>


          <div
            className="masterdata-form-actions"
            style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: "12px" }}
          >
            <button type="button" className="masterdata-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="masterdata-btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingSupplierCode ? "Update Supplier" : "Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MasterDataSupplierModal;
