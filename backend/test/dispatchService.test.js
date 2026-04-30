import assert from "node:assert/strict";
import { buildDispatchDashboardData } from "../src/services/dispatchService.js";

const callLog = [];
const client = {
  order: {
    async findMany(args) {
      callLog.push(["order.findMany", args]);
      return [
        {
          id: 1,
          salesOrderNumber: "SO_0001",
          salesGroupNumber: "SO_001",
          orderNo: "ORD-000001",
          product: "Product A",
          quantity: 10,
          price: 100,
          currency: "INR",
          unit: "KG",
          packingType: "NA",
          packingSize: "NA",
          deliveryDate: new Date("2026-04-30T00:00:00.000Z"),
          clientName: "Client A",
          city: "Mumbai",
          pincode: "400001",
          state: "Maharashtra",
          countryCode: "IN",
          status: "READY_FOR_DISPATCH",
          updatedAt: new Date("2026-04-30T10:00:00.000Z"),
          production: { id: 11, status: "COMPLETED", productionCompletionDate: new Date("2026-04-29T00:00:00.000Z") },
          dispatches: []
        }
      ];
    }
  },
  dispatch: {
    async findMany(args) {
      callLog.push(["dispatch.findMany", args]);
      return [
        {
          id: 2,
          dispatchedQuantity: 4,
          dispatchDate: new Date("2026-04-30T00:00:00.000Z"),
          packingDone: true,
          shipmentStatus: "PACKING",
          remarks: null,
          createdAt: new Date("2026-04-30T11:00:00.000Z"),
          order: {
            id: 2,
            salesOrderNumber: "SO_0002",
            salesGroupNumber: "SO_002",
            orderNo: "ORD-000002",
            product: "Product B",
            grade: "NA",
            quantity: 12,
            price: 120,
            currency: "INR",
            unit: "KG",
            packingType: "NA",
            packingSize: "NA",
            deliveryDate: new Date("2026-05-01T00:00:00.000Z"),
            dispatchDate: null,
            clientName: "Client B",
            city: "Pune",
            pincode: "411001",
            state: "Maharashtra",
            countryCode: "IN",
            status: "PARTIALLY_DISPATCHED",
            createdAt: new Date("2026-04-28T00:00:00.000Z"),
            updatedAt: new Date("2026-04-30T11:00:00.000Z"),
            enquiry: { id: 21, enquiryNumber: "ENQ_0021" },
            production: { id: 12, status: "COMPLETED", productionCompletionDate: new Date("2026-04-29T00:00:00.000Z") },
            dispatches: [{ dispatchedQuantity: 4, dispatchDate: new Date("2026-04-30T00:00:00.000Z"), shipmentStatus: "PACKING" }]
          }
        }
      ];
    }
  },
  enquiry: {
    async findMany() {
      callLog.push(["enquiry.findMany"]);
      throw new Error("Paginated dispatch dashboard should not load enquiries.");
    }
  },
  manualOrderRequest: {
    async findMany() {
      callLog.push(["manualOrderRequest.findMany"]);
      throw new Error("Paginated dispatch dashboard should not load manual requests.");
    }
  }
};

const result = await buildDispatchDashboardData(
  {
    paginated: "1",
    limit: "2",
    page: "1"
  },
  client
);

assert.equal(result.pagination.total, 2);
assert.equal(result.items.length, 2);
assert.deepEqual(
  callLog.map(([name]) => name),
  ["order.findMany", "dispatch.findMany"]
);

console.log("dispatchService assertions passed");
