import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const originalCwd = process.cwd();
const originalEnv = {
  ...process.env
};

const tempDir = mkdtempSync(path.join(os.tmpdir(), "nimbasia-env-"));

try {
  process.chdir(tempDir);

  delete process.env.CLIENT_ORIGIN;
  delete process.env.PORT;
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
  delete process.env.JWT_EXPIRES_IN;

  const envModuleUrl = pathToFileURL(path.resolve(originalCwd, "backend/src/config/env.js")).href;
  const { default: env } = await import(envModuleUrl);

  assert.equal(
    env.clientOrigin,
    "https://nimbasia.vercel.app,http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.*:5174,http://localhost:4173,http://127.0.0.1:4173,http://192.168.1.*:4173,http://app.nimbasia.com,https://app.nimbasia.com"
  );

  console.log("envConfig assertions passed");
} finally {
  process.chdir(originalCwd);
  process.env = originalEnv;
}
