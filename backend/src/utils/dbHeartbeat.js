import prisma from "../config/prisma.js";

// Hostinger's MySQL closes idle connections, so after a quiet spell the next
// real query pays a full reconnect — the one-off multi-second "cold" hit users
// saw on the first request of a burst. A lightweight query on a timer keeps the
// pooled connection alive so no user request is ever the one that reconnects.
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

let timer = null;

async function beat() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    // A failed heartbeat isn't fatal: the retry proxy will rebuild the client
    // on the next real query. Log it so a persistently unreachable DB is
    // visible rather than silently swallowed.
    console.warn("DB heartbeat failed:", error?.message || error);
  }
}

export function startDbHeartbeat() {
  if (timer) return;
  // unref() so this timer never keeps the process alive on its own during
  // shutdown — it should follow the server, not hold it open.
  timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}

export function stopDbHeartbeat() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
