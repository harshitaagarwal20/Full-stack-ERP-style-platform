import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuditValue } from "../src/utils/auditLog.js";

test("sanitizeAuditValue removes production machine fields from objects", () => {
  const input = {
    status: "PENDING",
    particleSize: "NA",
    acmRpm: 1000,
    classifierRpm: 1000,
    blowerRpm: 1000,
    rawMaterials: "NA",
    nested: {
      particleSize: "10 mm"
    }
  };

  const output = sanitizeAuditValue(input);

  assert.deepStrictEqual(output, {
    status: "PENDING",
    nested: {}
  });
  assert.deepStrictEqual(input.particleSize, "NA");
});

test("sanitizeAuditValue strips the same fields from array entries", () => {
  const input = [
    {
      id: 1,
      particleSize: "NA"
    },
    {
      id: 2,
      rawMaterials: "Resin"
    }
  ];

  const output = sanitizeAuditValue(input);

  assert.deepStrictEqual(output, [
    { id: 1 },
    { id: 2 }
  ]);
});

test("sanitizeAuditValue keeps only production view fields for production logs", () => {
  const input = {
    id: 9,
    orderId: 42,
    status: "IN_PROGRESS",
    assignedPersonnel: "Team A",
    deliveryDate: "2026-04-30T00:00:00.000Z",
    productSpecs: "Fine Powder",
    capacity: 100,
    particleSize: "NA",
    acmRpm: 1000,
    classifierRpm: 1000,
    blowerRpm: 1000,
    rawMaterials: "NA",
    remarks: "Updated",
    productionCompletionDate: null,
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T01:00:00.000Z",
    order: {
      id: 42,
      salesOrderNumber: "SO-001"
    }
  };

  const output = sanitizeAuditValue(input, "Production");

  assert.deepStrictEqual(output, {
    id: 9,
    orderId: 42,
    status: "IN_PROGRESS",
    assignedPersonnel: "Team A",
    deliveryDate: "2026-04-30T00:00:00.000Z",
    productSpecs: "Fine Powder",
    capacity: 100,
    remarks: "Updated",
    productionCompletionDate: null,
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T01:00:00.000Z"
  });
});

test("sanitizeAuditValue leaves primitives untouched", () => {
  assert.equal(sanitizeAuditValue("plain text"), "plain text");
  assert.equal(sanitizeAuditValue(42), 42);
});
