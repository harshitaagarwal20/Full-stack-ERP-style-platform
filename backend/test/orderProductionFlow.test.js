import test from "node:test";
import assert from "node:assert/strict";
import { moveOrderToProduction } from "../src/services/orderService.js";

test("moveOrderToProduction creates a production record for the production module", async () => {
  const calls = [];
  const fakeClient = {
    order: {
      async findUnique(args) {
        calls.push(["order.findUnique", args]);
        return {
          id: 42,
          status: "CREATED",
          clientName: "Acme Chemicals",
          city: "Mumbai",
          pincode: "400001",
          state: "Maharashtra",
          countryCode: "IN",
          quantity: 25,
          product: "GMS 90",
          grade: "A",
          packingType: "Bag",
          deliveryDate: new Date("2026-05-20T00:00:00.000Z"),
          salesOrderNumber: "SO_0001",
          production: null
        };
      },
      async update(args) {
        calls.push(["order.update", args]);
        return {
          id: 42,
          salesGroupNumber: "SO_001",
          salesOrderNumber: "SO_0001",
          orderNo: "ORD-000042",
          product: "GMS 90",
          grade: "A",
          quantity: 25,
          price: 100,
          currency: "INR",
          unit: "KG",
          packingType: "Bag",
          packingSize: "25 KG",
          deliveryDate: new Date("2026-05-20T00:00:00.000Z"),
          dispatchDate: null,
          clientName: "Acme Chemicals",
          address: null,
          city: "Mumbai",
          pincode: "400001",
          state: "Maharashtra",
          countryCode: "IN",
          status: "IN_PRODUCTION",
          orderDate: new Date("2026-05-10T00:00:00.000Z"),
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
          updatedAt: new Date("2026-05-10T00:00:00.000Z"),
          remarks: null,
          createdById: 1,
          enquiry: null,
          production: { id: 7, status: "PENDING", productionCompletionDate: null },
          dispatches: []
        };
      }
    },
    production: {
      async create(args) {
        calls.push(["production.create", args]);
        return {
          id: 7,
          orderId: 42,
          status: "PENDING",
          state: null,
          assignedPersonnel: "Acme Chemicals",
          deliveryDate: new Date("2026-05-20T00:00:00.000Z"),
          productSpecs: "GMS 90 (A)",
          capacity: 25,
          particleSize: "NA",
          acmRpm: 1000,
          classifierRpm: 1000,
          blowerRpm: 1000,
          rawMaterials: "Bag",
          remarks: "Auto-generated from order SO_0001",
          productionCompletionDate: null,
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
          updatedAt: new Date("2026-05-10T00:00:00.000Z"),
          order: { id: 42 }
        };
      }
    },
    async $executeRawUnsafe() {
      calls.push(["$executeRawUnsafe"]);
      return 1;
    }
  };

  const result = await moveOrderToProduction(42, { id: 3, name: "Sales User", role: "sales" }, fakeClient);

  assert.equal(result.status, "IN_PRODUCTION");
  assert.deepEqual(
    calls.map(([name]) => name),
    ["order.findUnique", "production.create", "order.update", "$executeRawUnsafe", "$executeRawUnsafe"]
  );
  assert.equal(calls[1][1].data.orderId, 42);
  assert.equal(calls[1][1].data.assignedPersonnel, "Acme Chemicals");
  assert.equal(calls[1][1].data.productSpecs, "GMS 90 (A)");
  assert.equal(calls[1][1].data.capacity, 25);
  assert.equal(calls[1][1].data.rawMaterials, "Bag");
  assert.equal(calls[2][1].data.status, "IN_PRODUCTION");
});
