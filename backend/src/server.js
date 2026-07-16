import app from "./app.js";
import env from "./config/env.js";
import prisma, { closePrisma } from "./config/prisma.js";
import { isRecoverablePrismaPanicError } from "./utils/prismaClientProxy.js";
import { ensurePermissionDefaults } from "./services/permissionService.js";
import { startDbHeartbeat, stopDbHeartbeat } from "./utils/dbHeartbeat.js";

let server;

async function start() {
  try {
    if (env.prismaStartupCheck) {
      try {
        await prisma.$connect();
      } catch (error) {
        if (!isRecoverablePrismaPanicError(error)) {
          throw error;
        }

        console.warn(
          "Prisma startup check hit a recoverable panic. Continuing startup so the app can serve requests:",
          error?.message || error
        );
      }
    } else {
      console.warn("Prisma startup check disabled. Running in diagnostics mode.");
    }

    // Seed any role/module pair that has never been stored, so a fresh database
    // starts with the same access rules the routes used to hard-code. Existing
    // admin choices are left alone (skipDuplicates).
    try {
      await ensurePermissionDefaults();
    } catch (error) {
      console.warn("Could not seed role permission defaults:", error?.message || error);
    }

    server = app.listen(env.port, "0.0.0.0", () => {
      console.log(`Access from this machine: http://localhost:${env.port}`);
      console.log(`Access from network: http://<your-machine-ip>:${env.port}`);
    });

    // Keep the pooled DB connection warm so no user request pays the idle
    // reconnect cost.
    startDbHeartbeat();
  } catch (error) {
    try {
      await closePrisma();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma after startup failure:", disconnectError);
    }

    throw error;
  }
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
