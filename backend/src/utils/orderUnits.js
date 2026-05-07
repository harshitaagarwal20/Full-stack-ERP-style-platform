const VALID_ORDER_UNITS = new Set(["KG", "MT", "LTR"]);

function normalizeCandidateUnit(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeOrderUnit(value, fallback = "KG") {
  const normalized = normalizeCandidateUnit(value);
  if (!normalized) return fallback;

  if (VALID_ORDER_UNITS.has(normalized)) {
    return normalized;
  }

  if (normalized === "KGS" || normalized === "KILOGRAM" || normalized === "KILOGRAMS") {
    return "KG";
  }

  if (normalized === "TON" || normalized === "TONNE" || normalized === "TONNES") {
    return "MT";
  }

  if (normalized === "LITER" || normalized === "LITRE" || normalized === "LITERS" || normalized === "LITRES") {
    return "LTR";
  }

  return fallback;
}

export function isValidOrderUnit(value) {
  return VALID_ORDER_UNITS.has(normalizeCandidateUnit(value));
}

