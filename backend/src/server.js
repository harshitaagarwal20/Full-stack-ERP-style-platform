import app from "./app.js";
import env from "./config/env.js";
import { closePrisma } from "./config/prisma.js";
import { ensurePermissionDefaults } from "./services/permissionService.js";
import { startDbHeartbeat, stopDbHeartbeat } from "./utils/dbHeartbeat.js";

let server;

// DB work that must not block app.listen(). Hostinger kills the app if listen()
// isn't called within 3s, and a Prisma/Accelerate round-trip can exceed that.
// So we bind the port first and warm/seed the database afterwards.
async function initializeDatabase() {
  // Seed any role/module pair that has never been stored, so a fresh database
  // starts with the same access rules the routes used to hard-code. Existing
  // admin choices are left alone (skipDuplicates).
  try {
    await ensurePermissionDefaults();
  } catch (error) {
    console.warn("Could not seed role permission defaults:", error?.message || error);
  }

  // Keep the pooled DB connection warm so no user request pays the idle
  // reconnect cost.
  startDbHeartbeat();
}

async function start() {
  server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`Access from this machine: http://localhost:${env.port}`);
    console.log(`Access from network: http://<your-machine-ip>:${env.port}`);
  });

  // Fire-and-forget: never let DB latency or errors delay/kill startup.
  void initializeDatabase();
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

async function shutdown(signal) {
  try {
    stopDbHeartbeat();
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    await closePrisma();
  } catch (error) {
    console.error(`Failed to close Prisma during ${signal} shutdown:`, error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
