import prismaPkg from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { createRetryablePrismaClientProxy } from "../utils/prismaClientProxy.js";

const { PrismaClient } = prismaPkg;

// When DATABASE_URL is a prisma:// Accelerate URL, run through Prisma
// Accelerate so the query engine executes in Prisma's cloud instead of on this
// host. Hostinger's shared runtime CPU-throttles the local query engine and it
// panics ("timer has gone away") on every query; Accelerate sidesteps that
// entirely. With a plain mysql:// URL (e.g. local dev) the client is used as-is.
const usingAccelerate = String(process.env.DATABASE_URL || "").startsWith("prisma://");

function createClient() {
  const client = new PrismaClient();
  return usingAccelerate ? client.$extends(withAccelerate()) : client;
}

const { prisma, close, reconnect } = createRetryablePrismaClientProxy({
  createClient
});

export default prisma;
export { reconnect as reconnectPrisma };

export async function closePrisma() {
  await close();
}
