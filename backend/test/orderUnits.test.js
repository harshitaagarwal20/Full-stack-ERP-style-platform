import assert from "node:assert/strict";
import { normalizeOrderUnit, isValidOrderUnit } from "../src/utils/orderUnits.js";
import { buildOrderCreateData } from "../src/services/orderService.js";

assert.equal(normalizeOrderUnit(" kg "), "KG");
assert.equal(normalizeOrderUnit("KGS"), "KG");
assert.equal(normalizeOrderUnit("ton"), "MT");
assert.equal(normalizeOrderUnit("litre"), "LTR");
assert.equal(normalizeOrderUnit("unsupported"), "KG");
assert.equal(normalizeOrderUnit("", "MT"), "MT");
assert.equal(isValidOrderUnit("KG"), true);
assert.equal(isValidOrderUnit("kg"), true);

const createData = buildOrderCreateData({
  payload: {
    grade: "A",
    quantity: 10,
    price: 100,
    currency: "INR",
    unit: "kgs",
    packing_type: "NA",
    packing_size: "NA",
    delivery_date: "2026-05-07",
    client_name: "Client A",
    address: "",
    city: "Mumbai",
    pincode: "400001",
    state: "Maharashtra",
    country_code: "IN",
    remarks: null
  },
  enquiry: null,
  createdByUser: { id: 1 },
  customerProfile: null,
  salesGroupNumber: "SO_001",
  product: "GMS 90"
});

assert.equal(createData.unit, "KG");

console.log("orderUnits assertions passed");
