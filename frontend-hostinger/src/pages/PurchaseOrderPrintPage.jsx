import { Fragment, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";
import { getShipToLocation } from "../config/shipToLocations";
import { formatPct, splitTax } from "../utils/gst";

const BILL_TO = {
  companyName: "NIMBASIA STABILIZERS",
  address: "F-172 A and B, F-173 Indraprastha Industrial Area, Road no 3,",
  pincode: "324005",
  mobile: "6376604855",
  district: "Kota",
  state: "Rajasthan"
};

const STANDARD_NOTES = [
  "All deliveries should reach our factory before 4.30 p.m.",
  "All materials should be packing with Grade, Batch No/Lot No, Date of Manufacturing & Expiry date clearly printed on individual bale /spool packing.",
  "Any rejection on account of quality of the product, the entire expenses towards salvage of the product, are to your account only, including freight, segregation, packing, loading, and other expenses.",
  "Ensure at least 60-75% of product's remaining SHELF LIFE when we receive the product at our end.",
  "Please Note that all the supplies are subject to polyhose supply Terms and conditions. Kindly ask for a copy if any doubts."
];

function formatPoDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// A purchase order is what we are asking the supplier to send, so every figure
// on this sheet is priced off the ordered quantity. What actually turned up is
// the GRN's business, not the PO's.
function calcRowTotal(item) {
  return Number(item.qty || 0) * Number(item.unitPrice || 0);
}

function calcAmountAfterTax(item) {
  return calcRowTotal(item) * (1 + (item.taxPercent || 0) / 100);
}

function formatNum(val) {
  if (val == null || val === "") return "-";
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

const DARK = "#1a3a5c";
const LIGHT_ROW = "#d6e4f7";

const styles = {
  page: {
    fontFamily: "Arial, sans-serif",
    fontSize: 11,
    color: "#000",
    padding: "20px 30px",
    maxWidth: 900,
    margin: "0 auto",
    background: "#fff"
  },
  title: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
    letterSpacing: 1
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: DARK,
    letterSpacing: 2
  },
  logoSub: {
    fontSize: 11,
    color: "#555",
    letterSpacing: 1
  },
  metaTable: {
    borderCollapse: "collapse",
    minWidth: 280
  },
  metaTh: {
    background: DARK,
    color: "#fff",
    padding: "4px 10px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 11,
    border: "1px solid #fff"
  },
  metaTd: {
    padding: "4px 10px",
    border: "1px solid #ccc",
    textAlign: "center",
    fontSize: 11
  },
  sectionTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 14
  },
  labelCell: {
    fontWeight: "bold",
    padding: "4px 8px",
    border: "1px solid #ccc",
    width: "30%",
    background: "#f5f5f5"
  },
  valueCell: {
    padding: "4px 8px",
    border: "1px solid #ccc"
  },
  addrHeader: {
    background: DARK,
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    padding: "5px",
    fontSize: 12,
    border: "1px solid #fff"
  },
  itemsTh: {
    background: DARK,
    color: "#fff",
    padding: "5px 8px",
    textAlign: "center",
    border: "1px solid #fff",
    fontSize: 10,
    fontWeight: "bold"
  },
  itemsTd: {
    padding: "4px 8px",
    border: "1px solid #ccc",
    textAlign: "center",
    fontSize: 10
  },
  itemsTdLeft: {
    padding: "4px 8px",
    border: "1px solid #ccc",
    textAlign: "left",
    fontSize: 10
  }
};

function PurchaseOrderPrintPage() {
  const { id } = useParams();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/purchase-orders/${id}`)
      .then(({ data }) => setPo(data))
      .catch((err) => logApiError(err, "Failed to load PO for print"))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      alert("Use Ctrl+P (or Cmd+P on Mac) to print / save as PDF.");
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  if (!po) return <div style={{ padding: 40, textAlign: "center" }}>Purchase order not found.</div>;

  const grossAmount = (po.items || []).reduce((s, i) => s + calcAmountAfterTax(i), 0);
  const shipToLocation = getShipToLocation(po.shipTo);
  const itemRows = po.items || [];

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 15mm; size: A4; }
        }
        body { background: #e0e0e0; }
      `}</style>

      <div className="no-print" style={{ background: DARK, color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Purchase Order — Print Preview</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>or press Ctrl+P</span>
          <button
            onClick={handlePrint}
            style={{ background: "#fff", color: DARK, border: "none", padding: "8px 20px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      <div style={styles.page}>
        {/* Title */}
        <div style={styles.title}>Purchase Order</div>

        {/* Logo + Meta */}
        <div style={styles.headerRow}>
          <div style={styles.logoBox}>
            <img src="/logo.png" alt="Nimbasia Stabilizers" style={{ height: 60, width: "auto", objectFit: "contain", background: "#fff", mixBlendMode: "multiply" }} />
          </div>
          <table style={styles.metaTable}>
            <tbody>
              <tr>
                <th style={styles.metaTh}>PO Number</th>
                <td style={styles.metaTd}>{po.poNumber}</td>
              </tr>
              <tr>
                <th style={styles.metaTh}>Date</th>
                <td style={styles.metaTd}>{formatPoDate(po.orderDate)}</td>
              </tr>
              <tr>
                <th style={styles.metaTh}>Department</th>
                <td style={styles.metaTd}>{po.department || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Supplier Details */}
        <table style={{ ...styles.sectionTable, marginBottom: 14 }}>
          <tbody>
            <tr>
              <td style={styles.labelCell}>Supplier Name</td>
              <td style={styles.valueCell}>{po.supplier?.name || "-"}</td>
            </tr>
            <tr>
              <td style={styles.labelCell}>Address</td>
              <td style={styles.valueCell}>{po.supplier?.address || ""}</td>
            </tr>
            <tr>
              <td style={styles.labelCell}>Pincode</td>
              <td style={styles.valueCell}>{po.supplier?.pincode || ""}</td>
            </tr>
            <tr>
              <td style={styles.labelCell}>GST No.</td>
              <td style={styles.valueCell}>{po.supplier?.gstNo || ""}</td>
            </tr>
            <tr>
              <td style={styles.labelCell}>PAN No.</td>
              <td style={styles.valueCell}>{po.supplier?.panNo || ""}</td>
            </tr>
            <tr>
              <td style={styles.labelCell}>Email</td>
              <td style={styles.valueCell}>{po.supplier?.email || ""}</td>
            </tr>
            <tr>
              <td style={styles.labelCell}>Mobile Number</td>
              <td style={styles.valueCell}>{po.supplier?.phone || ""}</td>
            </tr>
          </tbody>
        </table>

        {/* Bill To / Ship To */}
        <table style={{ ...styles.sectionTable, marginBottom: 14 }}>
          <thead>
            <tr>
              <td colSpan={2} style={styles.addrHeader}>Bill To Address</td>
              <td colSpan={2} style={styles.addrHeader}>Ship To Address</td>
            </tr>
          </thead>
          <tbody>
            {[
              ["Company Name", BILL_TO.companyName, shipToLocation.companyName],
              ["Address", BILL_TO.address, shipToLocation.addressLines.join(", ")],
              ["Pincode", BILL_TO.pincode, shipToLocation.pincode],
              ["Mobile", BILL_TO.mobile, shipToLocation.mobile],
              ["District", BILL_TO.district, shipToLocation.district],
              ["State", BILL_TO.state, shipToLocation.stateCodeLabel || shipToLocation.state],
              ["GSTIN", "", shipToLocation.gstin]
            ].map(([label, billVal, shipVal]) => (
              <tr key={label}>
                <td style={{ ...styles.labelCell, width: "15%" }}>{label}</td>
                <td style={{ ...styles.valueCell, width: "35%" }}>{billVal}</td>
                <td style={{ ...styles.labelCell, width: "15%" }}>{label}</td>
                <td style={{ ...styles.valueCell, width: "35%" }}>{shipVal}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Items Table */}
        <table style={{ ...styles.sectionTable, marginBottom: 4 }}>
          <thead>
            <tr>
              <th style={styles.itemsTh}>S.No</th>
              <th style={styles.itemsTh}>Item ID</th>
              <th style={styles.itemsTh}>Order QTY</th>
              <th style={styles.itemsTh}>UoM</th>
              <th style={styles.itemsTh}>Grade</th>
              <th style={styles.itemsTh}>Price Per Unit</th>
              <th style={styles.itemsTh}>Total Amount</th>
              <th style={styles.itemsTh}>SGST</th>
              <th style={styles.itemsTh}>CGST</th>
              <th style={styles.itemsTh}>IGST</th>
              <th style={styles.itemsTh}>Amount After Tax</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((item, idx) => {
              const remark = String(item.remark || "").trim();
              const tax = splitTax(item.taxPercent, po.supplier?.gstNo, shipToLocation?.gstin);
              return (
                <Fragment key={item.id}>
                  <tr style={{ background: idx % 2 === 0 ? "#fff" : LIGHT_ROW }}>
                    <td style={styles.itemsTd}>{idx + 1}</td>
                    <td style={styles.itemsTdLeft}>{item.itemId || "-"}</td>
                    <td style={styles.itemsTd}>{item.qty || 0}</td>
                    <td style={styles.itemsTd}>{item.uom || "-"}</td>
                    <td style={styles.itemsTd}>{item.grade || ""}</td>
                    <td style={styles.itemsTd}>{formatNum(item.unitPrice)}</td>
                    <td style={styles.itemsTd}>{formatNum(calcRowTotal(item))}</td>
                    <td style={styles.itemsTd}>{formatPct(tax.sgst)}</td>
                    <td style={styles.itemsTd}>{formatPct(tax.cgst)}</td>
                    <td style={styles.itemsTd}>{formatPct(tax.igst)}</td>
                    <td style={styles.itemsTd}>{formatNum(calcAmountAfterTax(item))}</td>
                  </tr>
                  {remark && (
                    <tr style={{ background: idx % 2 === 0 ? "#fff" : LIGHT_ROW }}>
                      <td style={{ ...styles.itemsTd, fontWeight: "bold" }}>Remark</td>
                      <td colSpan={10} style={styles.itemsTdLeft}>{remark}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={10} style={{ ...styles.itemsTd, textAlign: "right", fontWeight: "bold", padding: "5px 8px" }}>
                Gross Amount
              </td>
              <td style={{ ...styles.itemsTd, fontWeight: "bold" }}>{formatNum(grossAmount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Notes */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>Notes-</div>
          <table style={{ ...styles.sectionTable }}>
            <tbody>
              {STANDARD_NOTES.map((note, idx) => (
                <tr key={idx}>
                  <td style={{ ...styles.itemsTd, width: 30, background: "#e8edf5", fontWeight: "bold" }}>{idx + 1}</td>
                  <td style={{ ...styles.valueCell, fontSize: 10 }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default PurchaseOrderPrintPage;
