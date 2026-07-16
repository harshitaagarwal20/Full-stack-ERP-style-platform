import prisma from "../config/prisma.js";

// GST state codes, needed when a supplier master row records a state but no
// GSTIN. Keyed on the lowercased state name.
const GST_STATE_CODES = {
  "jammu and kashmir": "01", "himachal pradesh": "02", "punjab": "03",
  "chandigarh": "04", "uttarakhand": "05", "haryana": "06", "delhi": "07",
  "rajasthan": "08", "uttar pradesh": "09", "bihar": "10", "sikkim": "11",
  "arunachal pradesh": "12", "nagaland": "13", "manipur": "14", "mizoram": "15",
  "tripura": "16", "meghalaya": "17", "assam": "18", "west bengal": "19",
  "jharkhand": "20", "odisha": "21", "chhattisgarh": "22", "madhya pradesh": "23",
  "gujarat": "24", "maharashtra": "27", "karnataka": "29", "goa": "30",
  "kerala": "32", "tamil nadu": "33", "puducherry": "34", "telangana": "36",
  "andhra pradesh": "37"
};

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function stateNameToGstCode(state) {
  return GST_STATE_CODES[normalizeName(state)] || null;
}

// The Supplier rows the POs hang off were created ad hoc by findOrCreateSupplier
// and mostly carry no GSTIN. The real one usually lives in SupplierMaster, keyed
// by name — so a PO's tax treatment falls back to that rather than to a guess.
// Returns a GSTIN string, or null when the supplier's state is genuinely unknown.
export async function resolveSupplierGstin(supplier) {
  const own = String(supplier?.gstNo || "").trim();
  if (own) return own;

  const name = normalizeName(supplier?.name);
  if (!name) return null;

  const masters = await prisma.supplierMaster.findMany({
    where: { isActive: true },
    select: { supplierName: true, gstn: true, state: true },
    orderBy: { id: "asc" }
  });

  const match = masters.find((row) => normalizeName(row.supplierName) === name);
  if (!match) return null;

  const gstn = String(match.gstn || "").trim();
  if (gstn) return gstn;

  // No GSTIN on the master either, but a state name is enough to derive the
  // two-digit code the tax split actually keys on.
  const code = stateNameToGstCode(match.state);
  return code ? code : null;
}
