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

const fullCallLog = [];
const fullClient = {
  order: {
    async findMany(args) {
      fullCallLog.push(["order.findMany", args]);
      return [
        {
          id: 3,
          salesOrderNumber: "SO_0003",
          salesGroupNumber: "SO_003",
          orderNo: "ORD-000003",
          product: "Product C",
          quantity: 8,
          price: 80,
          currency: "INR",
          unit: "KG",
          packingType: "NA",
          packingSize: "NA",
          deliveryDate: new Date("2026-05-02T00:00:00.000Z"),
          clientName: "Client C",
          city: "Nashik",
          pincode: "422001",
          state: "Maharashtra",
          countryCode: "IN",
          status: "READY_FOR_DISPATCH",
          updatedAt: new Date("2026-05-01T10:00:00.000Z"),
          production: { id: 13, status: "COMPLETED", productionCompletionDate: new Date("2026-05-01T00:00:00.000Z") },
          dispatches: []
        }
      ];
    }
  },
  dispatch: {
    async findMany(args) {
      fullCallLog.push(["dispatch.findMany", args]);
      return [
        {
          id: 4,
          dispatchedQuantity: 2,
          dispatchDate: new Date("2026-05-02T00:00:00.000Z"),
          packingDone: true,
          shipmentStatus: "PACKING",
          remarks: null,
          createdAt: new Date("2026-05-02T11:00:00.000Z"),
          order: {
            id: 4,
            salesOrderNumber: "SO_0004",
            salesGroupNumber: "SO_004",
            orderNo: "ORD-000004",
            product: "Product D",
            grade: "NA",
            quantity: 6,
            price: 60,
            currency: "INR",
            unit: "KG",
            packingType: "NA",
            packingSize: "NA",
            deliveryDate: new Date("2026-05-03T00:00:00.000Z"),
            dispatchDate: null,
            clientName: "Client D",
            city: "Pune",
            pincode: "411001",
            state: "Maharashtra",
            countryCode: "IN",
            status: "PARTIALLY_DISPATCHED",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-02T11:00:00.000Z"),
            enquiry: { id: 22, enquiryNumber: "ENQ_0022" },
            production: { id: 14, status: "COMPLETED", productionCompletionDate: new Date("2026-05-01T00:00:00.000Z") },
            dispatches: [{ dispatchedQuantity: 2, dispatchDate: new Date("2026-05-02T00:00:00.000Z"), shipmentStatus: "PACKING" }]
          }
        }
      ];
    }
  },
  enquiry: {
    async findMany() {
      fullCallLog.push(["enquiry.findMany"]);
      return [
        {
          id: 31,
          enquiryNumber: "ENQ_0031",
          companyName: "Enquiry Client",
          product: "Product E",
          products: [],
          quantity: 5,
          price: 50,
          currency: "INR",
          unitOfMeasurement: "KG",
          expectedTimeline: new Date("2026-05-04T00:00:00.000Z"),
          assignedPerson: "Sales",
          status: "ACCEPTED",
          createdAt: new Date("2026-05-01T00:00:00.000Z")
        }
      ];
    }
  },
  manualOrderRequest: {
    async findMany() {
      fullCallLog.push(["manualOrderRequest.findMany"]);
      return [
        {
          id: 41,
          requestNumber: "MOR_0041",
          product: "Product F",
          packingType: "NA",
          packingSize: "NA",
          quantity: 3,
          unit: "KG",
          clientName: "Manual Client",
          address: null,
          dispatchDate: new Date("2026-05-05T00:00:00.000Z"),
          status: "APPROVED",
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          city: "Mumbai",
          pincode: "400001",
          state: "Maharashtra",
          countryCode: "IN"
        }
      ];
    }
  }
};

const fullResult = await buildDispatchDashboardData({}, fullClient);
assert.equal(fullResult.readyOrders.length, 1);
assert.equal(fullResult.dispatches.length, 1);
assert.equal(fullResult.dispatchDateOrders.length, 2);
assert.deepEqual(
  fullCallLog.map(([name]) => name),
  ["order.findMany", "dispatch.findMany", "enquiry.findMany", "manualOrderRequest.findMany", "order.findMany"]
);

console.log("dispatchService assertions passed");
