import { test } from "node:test";
import assert from "node:assert/strict";
import { CacheStore } from "../src/cache.js";

test("serves the fetched value on a cold cache", async () => {
  let calls = 0;
  const store = new CacheStore({ ttlMs: 60_000 });
  const value = await store.getOrFetch("k", async () => {
    calls += 1;
    return "v1";
  });
  assert.equal(value, "v1");
  assert.equal(calls, 1);
});

test("serves the stale value while revalidating in the background", async () => {
  const store = new CacheStore({ ttlMs: 1, staleMs: 60_000 });
  let version = "v1";
  await store.getOrFetch("k", async () => version);
  await new Promise((r) => setTimeout(r, 5));
  version = "v2";
  const value = await store.getOrFetch("k", async () => version);
  assert.equal(value, "v1"); // stale served immediately
});

test("propagates fetcher rejection when the cache is cold", async () => {
  const store = new CacheStore();
  await assert.rejects(
    store.getOrFetch("k", async () => {
      throw new Error("down");
    }),
    /down/,
  );
});
