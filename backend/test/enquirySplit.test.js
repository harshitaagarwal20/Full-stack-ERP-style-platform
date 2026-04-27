import assert from "node:assert/strict";
import { buildEnquiryRowData } from "../src/services/enquiryService.js";

const sharedData = {
  enquiryDate: new Date("2026-04-20T00:00:00.000Z"),
  modeOfEnquiry: "Website",
  companyName: "Dropdown Multi Enquiry Pvt. Ltd.",
  expectedTimeline: new Date("2026-05-05T00:00:00.000Z"),
  assignedPerson: "Saumya Mittal",
  notesForProduction: "Dropdown sample with multiple products.",
  remarks: "Created as a sample multi-product enquiry.",
  unitOfMeasurement: "KG"
};

const enquiryNumber = "ENQ_0010";
const rowA = buildEnquiryRowData({
  row: { product: "CALCIUM STEARATE", grade: "A", quantity: 20, unit_of_measurement: "KG" },
  enquiryNumber,
  sharedData,
  createdById: 1,
  approvedById: 1,
  status: "ACCEPTED"
});

const rowB = buildEnquiryRowData({
  row: { product: "ZINC STEARATE", grade: "B", quantity: 10, unit_of_measurement: "KG" },
  enquiryNumber,
  sharedData,
  createdById: 1,
  approvedById: 1,
  status: "ACCEPTED"
});

assert.equal(rowA.enquiryNumber, enquiryNumber);
assert.equal(rowB.enquiryNumber, enquiryNumber);
assert.equal(rowA.product, "CALCIUM STEARATE - A - 20 KG");
assert.equal(rowB.product, "ZINC STEARATE - B - 10 KG");
assert.deepEqual(rowA.products, [{ product: "CALCIUM STEARATE", grade: "A", quantity: 20, unit_of_measurement: "KG" }]);
assert.deepEqual(rowB.products, [{ product: "ZINC STEARATE", grade: "B", quantity: 10, unit_of_measurement: "KG" }]);
assert.equal(rowA.quantity, 20);
assert.equal(rowB.quantity, 10);
assert.equal(rowA.status, "ACCEPTED");
assert.equal(rowB.status, "ACCEPTED");

console.log("enquirySplit assertions passed");
