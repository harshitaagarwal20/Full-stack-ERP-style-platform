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

export async function getCustomerMasterProfileByName(customerName) {
  const nameCandidates = new Set(extractCustomerLookupNameCandidates(customerName));
  const codeCandidates = new Set(extractCustomerLookupCodeCandidates(customerName));
  if (!nameCandidates.size && !codeCandidates.size) return null;

  const rows = await prisma.$queryRaw`
    SELECT \`customerName\`, \`customerCode\`, \`address\`, \`city\`, \`pincode\`, \`state\`, \`countryCode\`
    FROM \`CustomerMaster\`
    WHERE \`isActive\` = 1
    ORDER BY \`id\` DESC
  `;

  const row = rows?.find((item) => {
    const rowName = normalizeName(item?.customerName);
    const rowCode = normalizeCode(item?.customerCode);
    if (rowName && nameCandidates.has(rowName)) return true;
    if (rowCode && codeCandidates.has(rowCode)) return true;
    return false;
  });
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
