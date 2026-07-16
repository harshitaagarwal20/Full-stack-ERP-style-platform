import prisma from "../config/prisma.js";

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value) {
  return normalize(value).replace(/\s+/g, " ").toLowerCase();
}

function normalizeCode(value) {
  return normalize(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function extractCustomerLookupNameCandidates(customerInput) {
  const raw = normalize(customerInput);
  if (!raw) return [];

  const candidates = new Set([raw, raw.replace(/\s+/g, " ")]);
  candidates.add(raw.replace(/\([^)]*\)\s*$/, "").trim());
  candidates.add(raw.replace(/\s*[-|]\s*[A-Za-z0-9]+$/, "").trim());

  return Array.from(candidates).map(normalizeName).filter(Boolean);
}

export function extractCustomerLookupCodeCandidates(customerInput) {
  const raw = normalize(customerInput);
  if (!raw) return [];

  const candidates = new Set();
  const bracketMatch = raw.match(/\(([^)]+)\)\s*$/);
  if (bracketMatch?.[1]) candidates.add(bracketMatch[1]);

  const separatorParts = raw.split(/\s*[-|]\s*/).filter(Boolean);
  if (separatorParts.length > 1) {
    candidates.add(separatorParts[separatorParts.length - 1]);
  }

  if (!/\s/.test(raw)) {
    candidates.add(raw);
  }

  return Array.from(candidates)
    .map(normalizeCode)
    .filter((value) => /[A-Z]/.test(value) && /\d/.test(value));
}

// Runs on every order creation, so it must not pull the whole customer master
// back to filter in JS. The name match — which is the case that actually fires
// almost every time — is pushed into SQL. Only if that misses do we fall back to
// code matching, and even then we look at rows that have a code at all, rather
// than every active customer.
export async function getCustomerMasterProfileByName(customerName) {
  const nameCandidates = [...new Set(extractCustomerLookupNameCandidates(customerName))];
  const codeCandidates = new Set(extractCustomerLookupCodeCandidates(customerName));
  if (!nameCandidates.length && !codeCandidates.size) return null;

  const COLUMNS = "`customerName`, `customerCode`, `address`, `city`, `pincode`, `state`, `countryCode`";
  let row = null;

  if (nameCandidates.length) {
    // Mirrors normalizeName(): trim + collapse runs of whitespace + lowercase.
    const placeholders = nameCandidates.map(() => "?").join(", ");
    const matches = await prisma.$queryRawUnsafe(
      `SELECT ${COLUMNS} FROM \`CustomerMaster\`
       WHERE \`isActive\` = 1
         AND LOWER(TRIM(REGEXP_REPLACE(\`customerName\`, '[[:space:]]+', ' '))) IN (${placeholders})
       ORDER BY \`id\` DESC
       LIMIT 1`,
      ...nameCandidates
    );
    row = matches?.[0] || null;
  }

  // The code form ("ACME (CU-001)") is rare, and normalizeCode strips every
  // non-alphanumeric, which SQL can't reproduce cheaply — so match those in JS,
  // but only across rows that actually carry a code.
  if (!row && codeCandidates.size) {
    const coded = await prisma.$queryRawUnsafe(
      `SELECT ${COLUMNS} FROM \`CustomerMaster\`
       WHERE \`isActive\` = 1 AND \`customerCode\` IS NOT NULL AND \`customerCode\` <> ''
       ORDER BY \`id\` DESC`
    );
    row = coded?.find((item) => {
      const rowCode = normalizeCode(item?.customerCode);
      return rowCode && codeCandidates.has(rowCode);
    }) || null;
  }

  if (!row) return null;

  return {
    customerName: normalize(row.customerName),
    address: normalize(row.address),
    city: normalize(row.city),
    pincode: normalize(row.pincode),
    state: normalize(row.state),
    countryCode: normalize(row.countryCode)
  };
}
