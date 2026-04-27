export function normalizePriceInput(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const error = new Error("Price must be a non-negative number.");
    error.statusCode = 400;
    throw error;
  }

  return numeric;
}

export function normalizeCurrencyInput(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;

  if (!/^[A-Z]{3}$/.test(normalized)) {
    const error = new Error("Currency must be a 3-letter ISO code.");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}
