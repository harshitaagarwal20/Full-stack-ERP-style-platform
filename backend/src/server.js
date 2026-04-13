import app from "./app.js";
import env from "./config/env.js";
import { closePrisma } from "./config/prisma.js";
import { ensureAuditLogTable } from "./services/auditService.js";

async function start() {
  await ensureAuditLogTable();
  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

async function shutdown(signal) {
  try {
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
