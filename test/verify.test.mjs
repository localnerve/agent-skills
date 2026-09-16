// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileInstance } from "../src/compile.js";
import { loadAll, loadConfig } from "../src/lib/loaders.js";
import { resolveAnchor, TIER0_LINE_BUDGET, verifyInstance } from "../src/verify.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Isolated out dir: compileInstance wipes the instance root, so tests must never
// share a directory with the committed out/ or with another test file.
const OUT = path.join(ROOT, ".tmp-verify-out");
const FIXTURE_REPO = path.join(ROOT, "test", "fixtures", "tiny-repo");
const PLATFORMS = ["copilot", "agents-md"];
const TMP = path.join(ROOT, ".tmp-verify");

test.before(async () => {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
});

test.after(async () => {
  await rm(OUT, { recursive: true, force: true });
});

async function setup() {
  const config = await loadConfig(path.join(ROOT, "config.json"));
  const instances = await loadAll(ROOT, config);
  await compileInstance(instances["tiny-repo"], ROOT, OUT, PLATFORMS);
  return { config, instances };
}

test("resolveAnchor: all four evidence kinds resolve on the fixture", async () => {
  assert.equal(await resolveAnchor({ kind: "file", ref: "src/cache.js" }, FIXTURE_REPO), null);
  assert.equal(await resolveAnchor({ kind: "symbol", ref: "getOrFetch", file: "src/cache.js" }, FIXTURE_REPO), null);
  assert.equal(await resolveAnchor({ kind: "grep", ref: "staleMs", file: "src/cache.js" }, FIXTURE_REPO), null);
  assert.equal(await resolveAnchor({ kind: "doc", ref: "docs/architecture.md" }, FIXTURE_REPO), null);
});

test("resolveAnchor: failure modes produce descriptive problems", async () => {
  assert.match(await resolveAnchor({ kind: "file", ref: "src/nope.js" }, FIXTURE_REPO), /does not exist/);
  assert.match(await resolveAnchor({ kind: "symbol", ref: "getOrFetch", file: "src/nope.js" }, FIXTURE_REPO), /does not exist/);
  assert.match(await resolveAnchor({ kind: "symbol", ref: "notASymbolHere", file: "src/cache.js" }, FIXTURE_REPO), /not found/);
  assert.match(await resolveAnchor({ kind: "grep", ref: "definitely-absent-xyz", file: "src/cache.js" }, FIXTURE_REPO), /not found/);
  // symbol anchors must respect word boundaries (no substring false positives):
  // "orFetch" is a substring of getOrFetch but not a standalone identifier.
  assert.match(
    await resolveAnchor({ kind: "symbol", ref: "orFetch", file: "src/cache.js" }, FIXTURE_REPO),
    /not found/,
  );
});

test("verifyInstance passes on the pristine fixture", async () => {
  const { instances } = await setup();
  const result = await verifyInstance(instances["tiny-repo"], FIXTURE_REPO, OUT, PLATFORMS);
  assert.deepEqual(result.failures, []);
});

test("durable drift is a hard failure; volatile drift is a warning", async () => {
  // Copy the fixture so we can mutate it without touching the real one.
  const sandbox = path.join(TMP, "repo");
  await rm(TMP, { recursive: true, force: true });
  await cp(FIXTURE_REPO, sandbox, { recursive: true });

  const { instances } = await setup();
  const instance = instances["tiny-repo"];

  // Break a DURABLE anchor: remove the toEnvelope symbol from errors.js.
  const errorsPath = path.join(sandbox, "src", "errors.js");
  let errorsSrc = await readFile(errorsPath, "utf8");
  errorsSrc = errorsSrc.replace("export function toEnvelope(", "function internalOnly(");
  await writeFile(errorsPath, errorsSrc);

  // Break a VOLATILE anchor: rename the 'items' cache key.
  const itemsPath = path.join(sandbox, "src", "routes", "items.js");
  let itemsSrc = await readFile(itemsPath, "utf8");
  itemsSrc = itemsSrc.replace("getOrFetch(\"items\"", "getOrFetch(\"item-list\"");
  await writeFile(itemsPath, itemsSrc);

  const result = await verifyInstance(instance, sandbox, OUT, PLATFORMS);
  assert.ok(
    result.failures.some((f) => f.includes("arch-error-envelope") && f.includes("durable")),
    `expected durable drift for arch-error-envelope, got: ${JSON.stringify(result.failures)}`,
  );
  assert.ok(
    result.warnings.some((w) => w.includes("arch-items-cache-key") && w.includes("volatile")),
    `expected volatile drift for arch-items-cache-key, got: ${JSON.stringify(result.warnings)}`,
  );

  await rm(TMP, { recursive: true, force: true });
});

test("missing emitted artifacts are reported", async () => {
  const emptyOut = path.join(TMP, "empty-out");
  await mkdir(emptyOut, { recursive: true });
  const { instances } = await setup();
  const result = await verifyInstance(instances["tiny-repo"], FIXTURE_REPO, emptyOut, PLATFORMS);
  assert.ok(result.failures.some((f) => f.includes("agent-skills.SKILL.md")));
  assert.ok(result.failures.some((f) => f.includes("AGENTS.md")));
  await rm(TMP, { recursive: true, force: true });
});

test("tier-0 line budget is enforced on emitted artifacts", async () => {
  // Build a synthetic instance whose tier-0 text blows the budget.
  const config = await loadConfig(path.join(ROOT, "config.json"));
  const instances = await loadAll(ROOT, config);
  const fat = structuredClone(instances["tiny-repo"]);
  fat.index.tier0.disciplines = Array.from({ length: TIER0_LINE_BUDGET + 5 }, (_, i) => `discipline number ${i + 1}`);

  const tmpOut = path.join(TMP, "fat-out");
  await compileInstance(fat, ROOT, tmpOut, PLATFORMS);
  const result = await verifyInstance(fat, FIXTURE_REPO, tmpOut, PLATFORMS);
  assert.ok(result.failures.some((f) => f.includes("tier-0 budget")));
  await rm(TMP, { recursive: true, force: true });
});

test("trigger-word collisions across categories are reported", async () => {
  const config = await loadConfig(path.join(ROOT, "config.json"));
  const instances = await loadAll(ROOT, config);
  const colliding = structuredClone(instances["tiny-repo"]);
  // Put a testing trigger word into the security category too.
  colliding.index.tier0.triggers.security.push("test");
  const result = await verifyInstance(colliding, FIXTURE_REPO, OUT, PLATFORMS);
  assert.ok(
    result.failures.some((f) => f.includes('"test"') && f.includes("disjoint")),
    `expected a disjointness failure, got: ${JSON.stringify(result.failures)}`,
  );
});
