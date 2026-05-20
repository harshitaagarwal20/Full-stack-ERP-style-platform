import assert from "node:assert/strict";
import { getApprovalListParams, normalizeApprovalStatus } from "../src/utils/approvalFilters.js";

assert.deepEqual(getApprovalListParams("ALL"), {
  enquiryParams: {},
  manualParams: {}
});

assert.deepEqual(getApprovalListParams("PENDING"), {
  enquiryParams: { status: "PENDING" },
  manualParams: { status: "REQUESTED" }
});

assert.deepEqual(getApprovalListParams("ACCEPTED"), {
  enquiryParams: { status: "ACCEPTED" },
  manualParams: {}
});

assert.deepEqual(getApprovalListParams("REJECTED"), {
  enquiryParams: { status: "REJECTED" },
  manualParams: { status: "REJECTED" }
});

assert.equal(normalizeApprovalStatus("manual", "REQUESTED"), "PENDING");
assert.equal(normalizeApprovalStatus("manual", "APPROVED"), "ACCEPTED");
assert.equal(normalizeApprovalStatus("manual", "ORDER_CREATED"), "ACCEPTED");
assert.equal(normalizeApprovalStatus("manual", "REJECTED"), "REJECTED");
assert.equal(normalizeApprovalStatus("enquiry", "ACCEPTED"), "ACCEPTED");
assert.equal(normalizeApprovalStatus("enquiry", undefined), "PENDING");

console.log("approvalFilters assertions passed");
