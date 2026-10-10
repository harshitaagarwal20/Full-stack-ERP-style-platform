import prismaPkg from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { createRetryablePrismaClientProxy } from "../utils/prismaClientProxy.js";
import { buildSslOption } from "../utils/dbSsl.js";

const { PrismaClient } = prismaPkg;

// Rust-free Prisma: the client (generated with previewFeatures
// driverAdapters + queryCompiler) compiles queries in JS and runs them through
// the native `mariadb` driver instead of Prisma's Rust query engine. That
// engine is what panicked with "timer has gone away" on Hostinger's
// CPU-throttled runtime; with no engine, that panic cannot happen. The mariadb
// driver speaks the MySQL wire protocol, so it connects to our MySQL fine.
function buildAdapterConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set.");
  }

  // DATABASE_URL is a mysql:// connection string; parse it into the pool config
  // the mariadb driver expects. Values are URL-decoded so passwords containing
  // encoded symbols (e.g. %40 for @) are passed through correctly.
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database: url.pathname.replace(/^\/+/, ""),
    ...buildSslOption(url),
    // Keep the pool small: Hostinger's MySQL caps concurrent connections and
    // this is a single low-traffic app instance.
    connectionLimit: 5,
    // Hostinger caps a DB user at 500 NEW connections per hour
    // (max_connections_per_hour) and closes idle ones. The driver's default is
    // to hold `connectionLimit` connections open at all times, so every idle
    // kill re-opened five of them and burned the hourly quota until the DB
    // locked everyone out ("pool timeout ... active=0 idle=0"). Keep just one
    // warm (the heartbeat feeds it), let bursts borrow more, and drop the
    // extras quickly instead of re-opening them.
    minimumIdle: 1,
    idleTimeout: 120,
    connectTimeout: 10000
  };
}

function createClient() {
  const adapter = new PrismaMariaDb(buildAdapterConfig());
  return new PrismaClient({ adapter });
}

const { prisma, close, reconnect } = createRetryablePrismaClientProxy({
  createClient
});

export default prisma;
export { reconnect as reconnectPrisma };

export async function closePrisma() {
  await close();
}
