// Shared, strict parsing for numeric route params (e.g. req.params.id).
// Using this everywhere instead of a bare `Number(req.params.id)` means a
// malformed id (non-numeric, negative, decimal) always produces the same
// clean 400 response shape, rather than silently becoming NaN and surfacing
// as an inconsistent Prisma validation error further down the stack.
export function toPositiveIntOrThrow(rawValue, fieldLabel = "id") {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`Invalid ${fieldLabel}.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}
