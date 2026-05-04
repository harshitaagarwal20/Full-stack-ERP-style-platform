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

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    message: "FMS API is running"
  });

  console.log("apiRoot assertions passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
