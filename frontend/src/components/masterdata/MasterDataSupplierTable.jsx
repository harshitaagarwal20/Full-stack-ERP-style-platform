import { useRef } from "react";
import VirtualizedTableBody from "../common/VirtualizedTableBody";
import { EditIcon, TrashIcon } from "../erp/ErpIcons";

function MasterDataSupplierTable({ loading, supplierRows, onEditSupplier, onDeleteSupplier, deletingSupplierld }) {
  const tableWrapRef = useRef(null);

  return (
    <section className="masterdata-card">
      <div className="masterdata-section-head">
        <h3>Supplier Records ({supplierRows.length})</h3>
      </div>
      {loading ? (
        <p style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>Loading supplier master data...</p>
      ) : supplierRows.length ? (
        <div className="masterdata-table-wrap" ref={tableWrapRef}>
          <table className="masterdata-table">
            <thead>
              <tr>
                <th>Supplier Code</th>
                <th>Supplier Name</th>
                <th>GSTN</th>
                <th>PAN No</th>
                <th>Country</th>
                <th>Address</th>
                <th>Pincode</th>
                <th>State</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <VirtualizedTableBody
              rows={supplierRows}
              colSpan={10}
              rowHeight={54}
              overscan={10}
              scrollContainerRef={tableWrapRef}
              getRowKey={(row, index) => row.id || row.supplierCode || index}
              renderRow={(row, _index, key) => (
                <tr key={key}>
                  <td><span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8", fontSize: 13 }}>{row.supplierCode || "-"}</span></td>
                  <td>{row.supplierName || "-"}</td>
                  <td>{row.gstn || "-"}</td>
                  <td>{row.panNo || "-"}</td>
                  <td>{row.country || "-"}</td>
                  <td>{row.address || "-"}</td>
                  <td>{row.pincode || "-"}</td>
                  <td>{row.state || "-"}</td>
                  <td>{row.city || "-"}</td>
                  <td>
                    <div className="order-row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onEditSupplier(row)}
                        disabled={!row.supplierCode}
                        title={row.supplierCode ? "Edit supplier" : "Supplier Code required for update"}
                        aria-label={`Edit supplier ${row.supplierName || row.supplierCode || row.id}`}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => onDeleteSupplier(row)}
                        disabled={deletingSupplierld === row.id}
                        title="Delete supplier"
                        aria-label={`Delete supplier ${row.supplierName || row.supplierCode || row.id}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            />
          </table>
        </div>
      ) : (
        <p style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
          No supplier records yet. Click <strong>"Add Supplier"</strong> button above to get started.
        </p>
      )}
    </section>
  );
}

export default MasterDataSupplierTable;
