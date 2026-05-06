import assert from "node:assert/strict";
import { parseDatabaseUrl } from "../src/services/mysqlHealthService.js";

const config = parseDatabaseUrl("mysql://demo_user:demo%40123@db.example.com:3307/demo_db");

assert.deepEqual(config, {
  host: "db.example.com",
  port: 3307,
  user: "demo_user",
  password: "demo@123",
  database: "demo_db",
  connectTimeout: 5000
});

assert.throws(
  () => parseDatabaseUrl("postgresql://demo:demo@localhost:5432/demo"),
  /Unsupported database protocol/
);

console.log("mysqlHealthService assertions passed");
