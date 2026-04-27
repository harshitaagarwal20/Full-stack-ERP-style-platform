function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toNameCandidates(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];

  const candidates = new Set([raw, raw.replace(/\s+/g, " ")]);
  candidates.add(raw.replace(/\([^)]*\)\s*$/, "").trim());
  candidates.add(raw.replace(/\s*[-|]\s*[A-Za-z0-9]+$/, "").trim());

  return Array.from(candidates)
    .map((item) => normalizeName(item))
    .filter(Boolean);
}

function toCodeCandidates(input) {
  const raw = String(input || "").trim();
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
    .map((item) => normalizeCode(item))
    .filter((item) => /[A-Z]/.test(item) && /\d/.test(item));
}

export function findCustomerProfile(customerRows, inputValue) {
  if (!Array.isArray(customerRows) || !customerRows.length) return null;

  const nameCandidates = new Set(toNameCandidates(inputValue));
  const codeCandidates = new Set(toCodeCandidates(inputValue));

  return (
    customerRows.find((row) => {
      const rowName = normalizeName(row?.customerName);
      const rowCode = normalizeCode(row?.customerCode);
      if (rowName && nameCandidates.has(rowName)) return true;
      if (rowCode && codeCandidates.has(rowCode)) return true;
      return false;
    }) || null
  );
}
