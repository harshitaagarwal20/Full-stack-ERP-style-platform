const DEFAULT_SENSITIVE_KEYS = new Set([
  "particleSize",
  "acmRpm",
  "classifierRpm",
  "blowerRpm",
  "rawMaterials"
]);

const PRODUCTION_VIEW_KEYS = new Set([
  "id",
  "orderId",
  "status",
  "state",
  "assignedPersonnel",
  "deliveryDate",
  "productSpecs",
  "capacity",
  "remarks",
  "productionCompletionDate",
  "createdAt",
  "updatedAt"
]);

function sanitizeValue(value, { sensitiveKeys = DEFAULT_SENSITIVE_KEYS, allowKeys = null } = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, { sensitiveKeys, allowKeys }));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKeys.has(key) && (!allowKeys || allowKeys.has(key)))
        .map(([key, item]) => [key, sanitizeValue(item, { sensitiveKeys, allowKeys })])
    );
  }

  return value;
}

export function sanitizeAuditValue(value, entityType = null) {
  if (entityType === "Production") {
    return sanitizeValue(value, { allowKeys: PRODUCTION_VIEW_KEYS });
  }

  return sanitizeValue(value);
}
