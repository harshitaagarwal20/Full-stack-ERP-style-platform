import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiBaseUrl } from "../src/api/apiBaseUrl.js";

test("keeps an explicit configured api url", () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: "https://example.com/api" }),
    "https://example.com/api"
  );
});

test("falls back to same-origin api for local development", () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: "" }), "/api");
});
