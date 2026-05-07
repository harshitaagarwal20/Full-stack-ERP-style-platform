import prismaPkg from "@prisma/client";
import { createRetryablePrismaClientProxy } from "../utils/prismaClientProxy.js";

const { PrismaClient } = prismaPkg;

function createClient() {
  return new PrismaClient();
}

const { prisma, close, reconnect } = createRetryablePrismaClientProxy({
  createClient
});

export default prisma;
export { reconnect as reconnectPrisma };

export async function closePrisma() {
  await close();
}
