import assert from "node:assert/strict";
import {
  extractCustomerLookupCodeCandidates,
  extractCustomerLookupNameCandidates
} from "../src/utils/customerCatalog.js";

assert.deepEqual(
  [...extractCustomerLookupNameCandidates("Acme Industries (ACM001)")].sort(),
  ["acme industries", "acme industries (acm001)"].sort()
);

assert.deepEqual(
  [...extractCustomerLookupNameCandidates("Acme Industries - ACM001")].sort(),
  ["acme industries - acm001", "acme industries"].sort()
);

assert.deepEqual(
  extractCustomerLookupCodeCandidates("Acme Industries (ACM001)"),
  ["ACM001"]
);

assert.deepEqual(
  extractCustomerLookupCodeCandidates("Acme Industries - ACM001"),
  ["ACM001"]
);

assert.deepEqual(
  extractCustomerLookupCodeCandidates("  ACM001  "),
  ["ACM001"]
);

console.log("customerCatalogLookup assertions passed");
