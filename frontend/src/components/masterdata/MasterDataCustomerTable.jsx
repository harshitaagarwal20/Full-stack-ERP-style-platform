import { useRef } from "react";
import VirtualizedTableBody from "../common/VirtualizedTableBody";
import { EditIcon, TrashIcon } from "../erp/ErpIcons";

function MasterDataCustomerTable({ loading, customerRows, onEditCustomer, onDeleteCustomer, deletingCustomerId }) {
  const tableWrapRef = useRef(null);

  return (
    <section className="masterdata-card">
      <div className="masterdata-section-head">
        <h3>Master Records ({customerRows.length})</h3>
      </div>
      {loading ? (
        <p style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>Loading customer master data...</p>
      ) : customerRows.length ? (
        <div className="masterdata-table-wrap" ref={tableWrapRef}>
          <table className="masterdata-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>GSTN</th>
                <th>Country</th>
                <th>Country Code</th>
                <th>Cust Initials</th>
                <th>S. No Code</th>
                <th>Customer Code</th>
                <th>Contact Person</th>
                <th>Contact Person Number</th>
                <th>Company Email</th>
                <th>Address</th>
                <th>Pincode</th>
                <th>State</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <VirtualizedTableBody
              rows={customerRows}
              colSpan={16}
              rowHeight={54}
              overscan={10}
              scrollContainerRef={tableWrapRef}
              getRowKey={(row, index) => row.id || row.customerCode || index}
              renderRow={(row, _index, key) => (
                <tr key={key}>
                  <td>{row.customerName || "-"}</td>
                  <td>{row.gstn || "-"}</td>
                  <td>{row.country || "-"}</td>
                  <td>{row.countryCode || "-"}</td>
                  <td>{row.custInitials || "-"}</td>
                  <td>{row.sNoCode || "-"}</td>
                  <td>{row.customerCode || "-"}</td>
                  <td>{row.contactPerson || "-"}</td>
                  <td>{row.contactPersonNumber || "-"}</td>
                  <td>{row.companyEmail || "-"}</td>
                  <td>{row.address || "-"}</td>
                  <td>{row.pincode || "-"}</td>
                  <td>{row.state || "-"}</td>
                  <td>{row.city || "-"}</td>
                  <td>
                    <div className="order-row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onEditCustomer(row)}
                        disabled={!row.customerCode}
                        title={row.customerCode ? "Edit customer" : "Customer Code required for update"}
                        aria-label={`Edit customer ${row.customerName || row.customerCode || row.id}`}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => onDeleteCustomer(row)}
                        disabled={deletingCustomerId === row.id}
                        title="Delete customer"
                        aria-label={`Delete customer ${row.customerName || row.customerCode || row.id}`}
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
          No customer records yet. Click <strong>"Add Customer"</strong> button above to get started.
        </p>
      )}
    </section>
  );
}

export default MasterDataCustomerTable;
