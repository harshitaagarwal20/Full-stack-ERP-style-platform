function MasterDataCustomerModal({
  isOpen,
  saving,
  editingCustomerCode,
  customerForm,
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
            <h3>{editingCustomerCode ? "Update Customer" : "Add New Customer"}</h3>
            <p>
              {editingCustomerCode
                ? `Updating customer code: ${editingCustomerCode}`
                : "Fill in customer details. Required fields are marked with *"}
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
                <label className="label">Customer Name <span className="req">*</span></label>
                <input
                  className={getInputClassName("customer_name")}
                  placeholder="Enter customer name"
                  value={customerForm.customer_name}
                  onChange={(e) => onFieldChange("customer_name", e.target.value)}
                  required
                />
                {formErrors.customer_name ? <small style={{ color: "#dc2626" }}>{formErrors.customer_name}</small> : null}
              </div>
              <div>
                <label className="label">Customer Code</label>
                <input
                  className={getInputClassName("customer_code")}
                  placeholder="Enter customer code"
                  value={customerForm.customer_code}
                  onChange={(e) => onFieldChange("customer_code", e.target.value)}
                  disabled={Boolean(editingCustomerCode)}
                />
                {formErrors.customer_code ? <small style={{ color: "#dc2626" }}>{formErrors.customer_code}</small> : null}
              </div>
              <div>
                <label className="label">Cust Initials</label>
                <input
                  className="input"
                  placeholder="e.g. ABC"
                  value={customerForm.cust_initials}
                  onChange={(e) => onFieldChange("cust_initials", e.target.value)}
                />
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
                  value={customerForm.country}
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
                <label className="label">Country Code</label>
                <input
                  className={getInputClassName("country_code")}
                  placeholder="IN"
                  value={customerForm.country_code}
                  onChange={(e) => onFieldChange("country_code", e.target.value)}
                />
              </div>
              <div>
                <label className="label">State</label>
                <select
                  className={getInputClassName("state")}
                  value={customerForm.state}
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
                  value={customerForm.city}
                  onChange={(e) => onFieldChange("city", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input
                  className={getInputClassName("pincode")}
                  placeholder="Enter pincode"
                  value={customerForm.pincode}
                  onChange={(e) => onFieldChange("pincode", e.target.value)}
                />
              </div>
              <div className="full-row">
                <label className="label">Address</label>
                <input
                  className={getInputClassName("address")}
                  placeholder="Enter full address"
                  value={customerForm.address}
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
                  value={customerForm.gstn}
                  onChange={(e) => onFieldChange("gstn", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Serial Code</label>
                <input
                  className={getInputClassName("s_no_code")}
                  placeholder="Enter serial code"
                  value={customerForm.s_no_code}
                  onChange={(e) => onFieldChange("s_no_code", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="masterdata-form-section">
            <h4>Contact Information</h4>
            <div className="masterdata-form-grid-two">
              <div>
                <label className="label">Contact Person</label>
                <input
                  className={getInputClassName("contact_person")}
                  placeholder="Enter contact person"
                  value={customerForm.contact_person}
                  onChange={(e) => onFieldChange("contact_person", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className={getInputClassName("contact_person_number")}
                  placeholder="Enter phone number"
                  value={customerForm.contact_person_number}
                  onChange={(e) => onFieldChange("contact_person_number", e.target.value)}
                />
              </div>
              <div className="full-row">
                <label className="label">Company Email</label>
                <input
                  className={getInputClassName("company_email")}
                  type="email"
                  placeholder="name@company.com"
                  value={customerForm.company_email}
                  onChange={(e) => onFieldChange("company_email", e.target.value)}
                />
                {formErrors.company_email ? <small style={{ color: "#dc2626" }}>{formErrors.company_email}</small> : null}
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
              {saving ? "Saving..." : editingCustomerCode ? "Update Customer" : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MasterDataCustomerModal;
