import { test } from "node:test";
import assert from "node:assert/strict";
import { toEnvelope } from "../src/errors.js";

test("produces the envelope shape with status", () => {
  const { status, body } = toEnvelope(new Error("boom"), { code: "bad" });
  assert.equal(status, 500);
  assert.deepStrictEqual(body, { error: { code: "bad", message: "boom" } });
});

test("defaults to the internal code", () => {
  const { body } = toEnvelope(new Error("x"));
  assert.deepStrictEqual(body, { error: { code: "internal", message: "x" } });
});
