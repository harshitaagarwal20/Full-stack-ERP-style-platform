import assert from "node:assert/strict";
import app from "../src/app.js";

const server = app.listen(0);

try {
  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const apiResponse = await fetch(`${baseUrl}/api`);
  assert.equal(apiResponse.status, 200);
  assert.deepEqual(await apiResponse.json(), {
    ok: true,
    message: "Nimbasia API is running. Use /api/health for health checks."
  });

  const rootResponse = await fetch(`${baseUrl}/`);
  assert.equal(rootResponse.status, 200);
  assert.deepEqual(await rootResponse.json(), {
    message:
      "Nimbasia backend is running. Production frontend: https://app.nimbasia.com. Health check: /api/health. Local dev frontend: http://localhost:5174."
  });

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    message: "FMS API is running"
  });

  const authRootResponse = await fetch(`${baseUrl}/api/auth`);
  assert.equal(authRootResponse.status, 200);
  assert.deepEqual(await authRootResponse.json(), {
    ok: true,
    message: "Auth API is running. Use POST /api/auth/login to sign in."
  });

  const authLoginInfoResponse = await fetch(`${baseUrl}/api/auth/login`);
  assert.equal(authLoginInfoResponse.status, 200);
  assert.deepEqual(await authLoginInfoResponse.json(), {
    ok: true,
    message: "Use POST /api/auth/login with email and password."
  });

  const corsResponse = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: "http://192.168.1.188:5174"
    }
  });
  assert.equal(corsResponse.status, 200);
  assert.equal(corsResponse.headers.get("access-control-allow-origin"), "http://192.168.1.188:5174");

  console.log("apiRoot assertions passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
