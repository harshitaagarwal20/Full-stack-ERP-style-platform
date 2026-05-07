import assert from "node:assert/strict";
import { createRetryablePrismaClientProxy, isRecoverablePrismaPanicError } from "../src/utils/prismaClientProxy.js";

assert.equal(isRecoverablePrismaPanicError(new Error("PANIC: timer has gone away")), true);

let createdClients = 0;
let disconnectedClients = 0;
let firstCall = true;

const { prisma, close } = createRetryablePrismaClientProxy({
  createClient: () => {
    createdClients += 1;
    const instance = createdClients;

    return {
      user: {
        async findUnique() {
          if (instance === 1 && firstCall) {
            firstCall = false;
            const error = new Error("PANIC: timer has gone away");
            error.name = "PrismaClientRustPanicError";
            throw error;
          }

          return { id: instance, email: "admin@gmail.com" };
        }
      },
      async $disconnect() {
        disconnectedClients += 1;
      }
    };
  }
});

const user = await prisma.user.findUnique({ where: { id: 1 } });
assert.deepEqual(user, { id: 2, email: "admin@gmail.com" });
assert.equal(createdClients, 2);
assert.equal(disconnectedClients, 1);

await close();
assert.equal(disconnectedClients, 2);

console.log("prismaClientProxy assertions passed");
