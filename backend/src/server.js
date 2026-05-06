import app from "./app.js";
import env from "./config/env.js";
import prisma, { closePrisma } from "./config/prisma.js";

let server;

async function start() {
  try {
    await prisma.$connect();

    server = app.listen(env.port, "0.0.0.0", () => {
      console.log(`Access from this machine: http://localhost:${env.port}`);
      console.log(`Access from network: http://<your-machine-ip>:${env.port}`);
    });
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
