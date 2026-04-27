import assert from "node:assert/strict";
import {
  formatEnquiryNumber,
  formatManualOrderRequestNumber,
  formatSalesOrderNumber,
  formatSalesGroupNumber,
  extractSalesGroupSequence,
  getDisplayEnquiryNumber,
  getDisplaySalesNumber as getBackendDisplaySalesNumber
} from "../src/utils/businessNumbers.js";
import {
  buildManualOrderCreateData,
  resolveSalesGroupNumberForManualRequest,
  setManualOrderDispatchDate
} from "../src/services/manualOrderRequestService.js";
import {
  getDisplayEnquiryNumber as getFrontendDisplayEnquiryNumber,
  getDisplaySalesGroupNumber,
  getDisplaySalesNumber as getFrontendDisplaySalesNumber,
  getDisplayManualOrderRequestNumber
} from "../../frontend/src/utils/businessNumbers.js";

assert.equal(formatSalesGroupNumber(1), "SO_001");
assert.equal(formatSalesGroupNumber(2), "SO_002");
assert.equal(extractSalesGroupSequence("SO_002"), 2);
assert.equal(formatEnquiryNumber(1), "ENQ_0001");
assert.equal(formatManualOrderRequestNumber(1), "MOR_0001");
assert.equal(formatSalesOrderNumber(1), "SO_0001");
assert.equal(getDisplayManualOrderRequestNumber({ id: 1 }), "MOR_0001");

const enquiryLinkedOrder = {
  id: 9,
  salesGroupNumber: "SO_0002",
  salesOrderNumber: "SO_000009",
  enquiry: {
    id: 22,
    enquiryNumber: "ENQ_0022"
  }
};

assert.equal(getDisplayEnquiryNumber(enquiryLinkedOrder.enquiry), "ENQ_0022");
assert.equal(getFrontendDisplayEnquiryNumber(enquiryLinkedOrder.enquiry), "ENQ_0022");
assert.equal(getBackendDisplaySalesNumber(enquiryLinkedOrder), "SO_002");
assert.equal(getFrontendDisplaySalesNumber(enquiryLinkedOrder), "SO_002");
assert.equal(getDisplaySalesGroupNumber(enquiryLinkedOrder), "SO_002");

const originalNow = Date.now;
Date.now = () => 1700000000000;
const manualOrderData = buildManualOrderCreateData(
  {
    id: 2,
    requestNumber: "MOR_0001",
    product: "GMS 90",
    grade: "AB",
    quantity: 150,
    unit: "KG",
    packingType: "NA",
    packingSize: "NA",
    dispatchDate: new Date("2026-05-02T00:00:00.000Z"),
    clientName: "ALGOL CHEMICAL INDIA PVT. LTD.",
    address: "Some Address",
    city: "Mumbai",
    pincode: "421302",
    state: "Maharashtra",
    countryCode: "IN",
    remarks: "Created from manual request MOR_0001: GMS 90 - AB - 150 KG"
  },
  { id: 1 },
  null,
  "SO_0003"
);
Date.now = originalNow;

assert.equal(manualOrderData.createdById, 1);
assert.equal(manualOrderData.salesGroupNumber, "SO_003");
assert.equal(manualOrderData.salesOrderNumber, "TSO-1700000000000-2");
assert.equal(manualOrderData.orderNo, "TMP-1700000000000-2");
assert.equal(manualOrderData.clientName, "ALGOL CHEMICAL INDIA PVT. LTD.");
assert.equal(manualOrderData.unit, "KG");
assert.equal(Object.hasOwn(manualOrderData, "enquiryId"), false);

const manualGroupTx = {
  order: {
    findFirst: async ({ where }) => {
      if (where?.manualOrderRequest?.requestNumber === "MOR_0003") {
        return { salesGroupNumber: "SO_009" };
      }
      return null;
    },
    findMany: async () => []
  }
};

assert.equal(
  await resolveSalesGroupNumberForManualRequest({ requestNumber: "MOR_0003" }, manualGroupTx),
  "SO_009"
);
assert.equal(
  await resolveSalesGroupNumberForManualRequest({ requestNumber: "MOR_0004" }, manualGroupTx),
  "SO_001"
);

await assert.rejects(
  () => setManualOrderDispatchDate(
    2,
    { dispatch_date: "2026-05-04" },
    { id: 1, name: "Test Admin", role: "admin" }
  ),
  (error) => error.statusCode === 409 && error.message === "Order already created for this manual request."
);

console.log("salesNumbers assertions passed");
