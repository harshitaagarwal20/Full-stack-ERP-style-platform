import assert from "node:assert/strict";
import { formatEnquiryProducts, getPrimaryEnquiryProduct, normalizeEnquiryProducts } from "../src/utils/enquiryProducts.js";

assert.deepEqual(
  normalizeEnquiryProducts(["  CALCIUM STEARATE  ", "", "ZINC STEARATE", "calcium stearate"]),
  ["CALCIUM STEARATE", "ZINC STEARATE"]
);

assert.deepEqual(
  normalizeEnquiryProducts("CALCIUM STEARATE, ZINC STEARATE,  GMS 90"),
  ["CALCIUM STEARATE", "ZINC STEARATE", "GMS 90"]
);

assert.deepEqual(
  normalizeEnquiryProducts([
    { product: "PE WAX", grade: "A", quantity: 20, unit_of_measurement: "KG" },
    { product: "PE WAX", grade: "A", quantity: 18, unit_of_measurement: "KG" },
    { product: "ZINC STEARATE", grade: "B", quantity: 10, unit_of_measurement: "MT" }
  ]),
  ["PE WAX", "ZINC STEARATE"]
);

assert.equal(formatEnquiryProducts([], "CALCIUM STEARATE"), "CALCIUM STEARATE");
assert.equal(formatEnquiryProducts([], "CALCIUM STEARATE, ZINC STEARATE"), "CALCIUM STEARATE, ZINC STEARATE");
assert.equal(
  formatEnquiryProducts([
    { product: "CALCIUM STEARATE", grade: "A", quantity: 20, unit_of_measurement: "KG" },
    { product: "ZINC STEARATE", grade: "B", quantity: 10, unit_of_measurement: "KG" }
  ]),
  "CALCIUM STEARATE - A - 20 KG, ZINC STEARATE - B - 10 KG"
);

assert.equal(
  getPrimaryEnquiryProduct({ products: ["  PE WAX  ", "ZINC STEARATE"], product: "CALCIUM STEARATE" }),
  "PE WAX"
);
assert.equal(
  getPrimaryEnquiryProduct({ products: [{ product: "PE WAX", grade: "A" }, { product: "ZINC STEARATE", grade: "B" }] }),
  "PE WAX"
);
assert.equal(getPrimaryEnquiryProduct({ product: "MAGNESIUM STEARATE" }), "MAGNESIUM STEARATE");

console.log("enquiryProducts assertions passed");
