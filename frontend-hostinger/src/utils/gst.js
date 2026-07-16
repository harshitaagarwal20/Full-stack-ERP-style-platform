// The first two digits of a GSTIN are the state code.
export function gstStateCode(gstin) {
  const code = String(gstin || "").trim().slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

// Place of supply decides how the one tax rate on a PO item is charged: a
// supplier in the same state as the Ship To address is an intra-state supply and
// splits half to SGST and half to CGST; a different state is inter-state and the
// whole rate is IGST.
//
// Splitting the rate we already hold — rather than storing three of them — is
// what keeps these three figures from ever disagreeing with the amount-after-tax
// beside them.
//
// A supplier with no readable GSTIN cannot be shown to be in-state, so it falls
// to IGST rather than inventing a state split we cannot support.
export function splitTax(taxPercent, supplierGstin, shipToGstin) {
  const tax = Number(taxPercent || 0);
  const supplierState = gstStateCode(supplierGstin);
  const shipToState = gstStateCode(shipToGstin);
  const intraState = Boolean(supplierState && shipToState && supplierState === shipToState);

  return intraState
    ? { sgst: tax / 2, cgst: tax / 2, igst: 0 }
    : { sgst: 0, cgst: 0, igst: tax };
}

export function formatPct(val) {
  return `${Number(val || 0).toFixed(2)}%`;
}
