import test from "node:test";
import assert from "node:assert/strict";
import { DATA_SYNC_EVENT, DATA_SYNC_STORAGE_KEY, publishDataSync, shouldBroadcastDataSync } from "../src/utils/dataSync.js";

test("shouldBroadcastDataSync only allows mutating operational requests", () => {
  assert.equal(shouldBroadcastDataSync({ method: "POST", url: "/orders" }), true);
  assert.equal(shouldBroadcastDataSync({ method: "put", url: "https://app.example.com/dispatch/1" }), true);
  assert.equal(shouldBroadcastDataSync({ method: "GET", url: "/production" }), false);
  assert.equal(shouldBroadcastDataSync({ method: "POST", url: "/auth/login" }), false);
});

test("publishDataSync emits a window event and writes a storage payload", () => {
  const events = [];
  const storage = new Map();
  const originalWindow = globalThis.window;
  const originalCustomEvent = globalThis.CustomEvent;

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };

  globalThis.window = {
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    localStorage: {
      setItem(key, value) {
        storage.set(key, value);
      }
    }
  };

  const result = publishDataSync({ method: "post", url: "/orders/12" });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, DATA_SYNC_EVENT);
  assert.deepEqual(events[0].detail.method, "post");
  assert.deepEqual(events[0].detail.url, "/orders/12");
  assert.equal(typeof events[0].detail.issuedAt, "number");
  assert.equal(storage.has(DATA_SYNC_STORAGE_KEY), true);
  assert.equal(JSON.parse(storage.get(DATA_SYNC_STORAGE_KEY)).url, "/orders/12");
  assert.equal(result.url, "/orders/12");

  globalThis.window = originalWindow;
  globalThis.CustomEvent = originalCustomEvent;
});
