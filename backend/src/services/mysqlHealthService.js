import mysql from "mysql2/promise";
import env from "../config/env.js";

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is not configured.");
    error.statusCode = 500;
    throw error;
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    const error = new Error("DATABASE_URL is not a valid connection string.");
    error.statusCode = 500;
    throw error;
  }

  if (!["mysql:", "mysql2:"].includes(url.protocol)) {
    const error = new Error(`Unsupported database protocol: ${url.protocol}`);
    error.statusCode = 500;
    throw error;
  }

  const database = url.pathname.replace(/^\/+/, "");

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || "3306", 10),
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database,
    connectTimeout: 5000
  };
}

export async function testMysqlConnection(databaseUrl) {
  // The mysql2 driver can only speak to a raw mysql:// endpoint. When
  // DATABASE_URL is a prisma:// Accelerate URL, fall back to the direct
  // connection so this diagnostic still reaches the real database.
  const rawUrl =
    databaseUrl ||
    (String(env.dbUrl || "").startsWith("prisma://") ? env.directDbUrl : env.dbUrl);
  const connectionConfig = parseDatabaseUrl(rawUrl);
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.ping();
    const [rows] = await connection.query("SELECT 1 AS ok");

    return {
      ok: true,
      message: "MySQL connection successful.",
      database: connectionConfig.database,
      host: connectionConfig.host,
      result: Array.isArray(rows) ? rows[0] : null
    };
  } finally {
    await connection.end();
  }
}

export { parseDatabaseUrl };
