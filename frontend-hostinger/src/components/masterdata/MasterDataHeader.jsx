function MasterDataHeader({ onAddCustomer }) {
  return (
    <section className="masterdata-card masterdata-header-card">
      <div className="masterdata-header-right">
        <div>
          <h2>Customer Master Data</h2>
        </div>
        <button type="button" className="masterdata-btn-primary" onClick={onAddCustomer}>
          + Add Customer
        </button>
      </div>
    </section>
  );
}

export default MasterDataHeader;
