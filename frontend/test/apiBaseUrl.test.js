import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiBaseUrl } from "../src/api/apiBaseUrl.js";

test("keeps an explicit configured api url", () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: "https://example.com/api" }),
    "https://example.com/api"
  );
});

test("rewrites legacy render api urls to the current backend", () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: "https://nimbasia.onrender.com/api" }),
    "https://manage.nimbasia.com/api"
  );

  assert.equal(
    resolveApiBaseUrl({ configuredUrl: "https://nimbasia-backend.onrender.com/api" }),
    "https://manage.nimbasia.com/api"
  );
});

test("falls back to same-origin api for local development", () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: "", hostname: "localhost" }), "/api");
});
