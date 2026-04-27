import assert from "node:assert/strict";
import { buildEnquiryRowData } from "../src/services/enquiryService.js";
import { buildOrderCreateData, buildOrderUpdateData } from "../src/services/orderService.js";
import { normalizeCurrencyInput, normalizePriceInput } from "../src/utils/commerce.js";

assert.equal(normalizePriceInput(undefined), undefined);
assert.equal(normalizePriceInput(null), null);
assert.equal(normalizePriceInput("125.5"), 125.5);
assert.equal(normalizeCurrencyInput(undefined), undefined);
assert.equal(normalizeCurrencyInput(null), null);
assert.equal(normalizeCurrencyInput("inr"), "INR");
assert.equal(normalizeCurrencyInput(""), null);

assert.throws(
  () => normalizePriceInput("-1"),
  (error) => error.statusCode === 400 && error.message === "Price must be a non-negative number."
);

assert.throws(
  () => normalizeCurrencyInput("india"),
  (error) => error.statusCode === 400 && error.message === "Currency must be a 3-letter ISO code."
);

const enquiryRow = buildEnquiryRowData({
  row: {
    product: "PE WAX",
    grade: "A",
    quantity: 10,
    unit_of_measurement: "KG"
  },
  enquiryNumber: "ENQ_0001",
  sharedData: {
    enquiryDate: new Date("2026-04-01T00:00:00.000Z"),
    modeOfEnquiry: "Phone",
    companyName: "Apex Polymers",
    price: 2500,
    currency: "INR",
    expectedTimeline: new Date("2026-04-10T00:00:00.000Z"),
    assignedPerson: "Sales Lead",
    notesForProduction: "Urgent",
    remarks: null,
    unitOfMeasurement: "KG"
  },
  createdById: 1,
  status: "PENDING"
});

assert.equal(enquiryRow.price, 2500);
assert.equal(enquiryRow.currency, "INR");

const orderFromPayload = buildOrderCreateData({
  payload: {
    price: "123.45",
    currency: "usd",
    grade: "A",
    quantity: 10,
    unit: "KG",
    packing_type: "Bag",
    packing_size: "25 KG",
    delivery_date: "2026-05-01",
    client_name: "Acme Chemicals",
    remarks: "Priority",
    address: "",
    city: "Mumbai",
    pincode: "400001",
    state: "Maharashtra",
    country_code: "IN"
  },
  enquiry: { id: 7, price: 200, currency: "EUR" },
  createdByUser: { id: 3 },
  customerProfile: null,
  salesGroupNumber: "SO_003",
  product: "GMS 90"
});

assert.equal(orderFromPayload.price, 123.45);
assert.equal(orderFromPayload.currency, "USD");
assert.equal(orderFromPayload.address, null);

const orderFromEnquiryDefaults = buildOrderCreateData({
  payload: {
    grade: "A",
    quantity: 10,
    unit: "KG",
    packing_type: "Bag",
    packing_size: "25 KG",
    delivery_date: "2026-05-01",
    client_name: "Acme Chemicals",
    remarks: "Priority",
    address: "",
    city: "Mumbai",
    pincode: "400001",
    state: "Maharashtra",
    country_code: "IN"
  },
  enquiry: { id: 7, price: 200, currency: "EUR" },
  createdByUser: { id: 3 },
  customerProfile: null,
  salesGroupNumber: "SO_003",
  product: "GMS 90"
});

assert.equal(orderFromEnquiryDefaults.price, 200);
assert.equal(orderFromEnquiryDefaults.currency, "EUR");

const updatedOrder = buildOrderUpdateData({
  price: "77.1",
  currency: "inr",
  client_name: "Acme Chemicals",
  city: "Mumbai"
});

assert.equal(updatedOrder.price, 77.1);
assert.equal(updatedOrder.currency, "INR");
assert.equal(updatedOrder.clientName, "Acme Chemicals");

console.log("commerceFields assertions passed");
