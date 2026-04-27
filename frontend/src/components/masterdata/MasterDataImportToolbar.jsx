function MasterDataImportToolbar({ importing, importFileName, onImportFileSelected }) {
  return (
    <section className="masterdata-card">
      <div style={{ display: "grid", gap: "16px", flex: 1 }}>
        <label className="masterdata-label">Import Customer Sheet (CSV or Excel)</label>
        <div className="masterdata-toolbar">
          <input
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={onImportFileSelected}
            disabled={importing}
            className="input"
          />
          {importing ? <small style={{ color: "#2563eb", fontWeight: 600 }}>Importing...</small> : null}
          {importFileName ? (
            <small style={{ color: "#6b7280" }}>
              Last selected: <strong>{importFileName}</strong>
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default MasterDataImportToolbar;
