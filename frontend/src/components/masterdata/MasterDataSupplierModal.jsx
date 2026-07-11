import SearchableSelect from "../common/SearchableSelect";

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
              <div>
                <label className="label">Supplier Code</label>
                <input
                  className={getInputClassName("supplier_code")}
                  placeholder="Auto-generated"
                  value={supplierForm.supplier_code}
                  disabled
                  style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}
                />
                {!supplierForm.supplier_code && !editingSupplierCode && <small style={{ color: "#6b7280" }}>Will be auto-generated</small>}
              </div>
              <div>
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
              <div>
                <label className="label">Contact Person</label>
                <input
                  className={getInputClassName("contact_person")}
                  placeholder="Enter contact person"
                  value={supplierForm.contact_person}
                  onChange={(e) => onFieldChange("contact_person", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className={getInputClassName("contact_person_number")}
                  placeholder="Enter phone number"
                  value={supplierForm.contact_person_number}
                  onChange={(e) => onFieldChange("contact_person_number", e.target.value)}
                />
              </div>
              <div className="full-row">
                <label className="label">Company Email</label>
                <input
                  className={getInputClassName("company_email")}
                  type="email"
                  placeholder="name@company.com"
                  value={supplierForm.company_email}
                  onChange={(e) => onFieldChange("company_email", e.target.value)}
                />
                {formErrors.company_email ? <small style={{ color: "#dc2626" }}>{formErrors.company_email}</small> : null}
              </div>
            </div>
          </section>

          <section className="masterdata-form-section">
            <h4>Location Details</h4>
            <div className="masterdata-form-grid-two">
              <div>
                <label className="label">Country</label>
                <SearchableSelect
                  options={countryOptions.map((option) => ({ value: option.value, label: option.value }))}
                  value={supplierForm.country}
                  onChange={(value) => {
                    onFieldChange("country", value);
                    const matching = countryOptions.find((item) => item.value === value);
                    if (matching) onFieldChange("country_code", matching.code);
                  }}
                  placeholder="Select country"
                />
              </div>
              <div>
                <label className="label">Country Code</label>
                <input
                  className={getInputClassName("country_code")}
                  placeholder="IN"
                  value={supplierForm.country_code}
                  onChange={(e) => onFieldChange("country_code", e.target.value)}
                />
              </div>
              <div>
                <label className="label">State</label>
                <SearchableSelect
                  options={stateOptions.map((state) => ({ value: state, label: state }))}
                  value={supplierForm.state}
                  onChange={(value) => onFieldChange("state", value)}
                  placeholder="Select state"
                />
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
