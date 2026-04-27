import assert from "node:assert/strict";
import { buildProductionUpdateData } from "../src/services/productionService.js";

const longRemarks = `Batch tracking summary ${"x".repeat(5000)}`;

const normalized = buildProductionUpdateData(
  {
    assigned_personnel: "  Production Team  ",
    delivery_date: "2026-04-21",
    product_specs: "  GMS 90 / Fine Powder  ",
    capacity: "42",
    particle_size: "  NA  ",
    acm_rpm: "1000",
    classifier_rpm: 1200,
    blower_rpm: "1500",
    raw_materials: "  Resin Blend  ",
    remarks: "  Completed successfully  ",
    status: "IN_PROGRESS",
    state: "  Maharashtra  "
  },
  { status: "PENDING" }
);

assert.deepEqual(normalized, {
  assignedPersonnel: "Production Team",
  deliveryDate: new Date("2026-04-21"),
  productSpecs: "GMS 90 / Fine Powder",
  capacity: 42,
  particleSize: "NA",
  acmRpm: 1000,
  classifierRpm: 1200,
  blowerRpm: 1500,
  rawMaterials: "Resin Blend",
  remarks: "Completed successfully",
  status: "IN_PROGRESS",
  state: "Maharashtra"
});

assert.deepEqual(buildProductionUpdateData({}, { status: "PENDING" }), {});

assert.deepEqual(
  buildProductionUpdateData({ status: "IN_PROGRESS" }, { status: "PENDING", statusChangeCount: 0 }),
  { status: "IN_PROGRESS" }
);

assert.deepEqual(
  buildProductionUpdateData({ status: "HOLD" }, { status: "IN_PROGRESS", statusChangeCount: 1 }),
  { status: "HOLD" }
);

assert.equal(
  buildProductionUpdateData({ remarks: longRemarks }, { status: "PENDING" }).remarks,
  longRemarks
);

assert.throws(
  () => buildProductionUpdateData({ capacity: "abc" }, { status: "PENDING" }),
  (error) => error.statusCode === 400 && error.message === "Capacity must be a positive integer."
);

assert.throws(
  () => buildProductionUpdateData({ status: "HOLD" }, { status: "IN_PROGRESS", statusChangeCount: 2 }),
  (error) => error.statusCode === 400 && error.message === "Status update is allowed only twice."
);

assert.throws(
  () => buildProductionUpdateData({ status: "HOLD" }, { status: "COMPLETED", statusChangeCount: 0 }),
  (error) => error.statusCode === 400 && error.message === "Production status cannot be changed after completion."
);

console.log("productionService assertions passed");
