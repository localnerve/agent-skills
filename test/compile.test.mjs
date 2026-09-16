// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileInstance } from "../src/compile.js";
import { loadAll, loadConfig } from "../src/lib/loaders.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Isolated out dir: compileInstance wipes the instance root, so tests must never
// share a directory with the committed out/ or with another test file.
const OUT = path.join(ROOT, ".tmp-compile-out");
const PLATFORMS = ["copilot", "agents-md"];

test.before(async () => {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
});

test.after(async () => {
  await rm(OUT, { recursive: true, force: true });
});

async function compileTiny() {
  const config = await loadConfig(path.join(ROOT, "config.json"));
  const instances = await loadAll(ROOT, config);
  return compileInstance(instances["tiny-repo"], ROOT, OUT, PLATFORMS);
}

test("compile emits the full expected artifact set", async () => {
  const written = await compileTiny();
  // compileInstance returns paths relative to the repo root, prefixed with ".tmp-compile-out/".
  for (const expected of [
    ".tmp-compile-out/tiny-repo/copilot/agent-skills.SKILL.md",
    ".tmp-compile-out/tiny-repo/copilot/skills/architecture.SKILL.md",
    ".tmp-compile-out/tiny-repo/copilot/skills/testing.SKILL.md",
    ".tmp-compile-out/tiny-repo/copilot/skills/security.SKILL.md",
    ".tmp-compile-out/tiny-repo/copilot/ref/architecture.md",
    ".tmp-compile-out/tiny-repo/copilot/ref/testing.md",
    ".tmp-compile-out/tiny-repo/copilot/ref/security.md",
    ".tmp-compile-out/tiny-repo/agents-md/AGENTS.md",
    ".tmp-compile-out/tiny-repo/agents-md/docs/agent-rules/architecture.md",
    ".tmp-compile-out/tiny-repo/agents-md/docs/agent-rules/testing.md",
    ".tmp-compile-out/tiny-repo/agents-md/docs/agent-rules/security.md",
  ]) {
    assert.ok(written.includes(expected), `expected artifact ${expected} to be written`);
  }
});

test("compile output is deterministic (byte-identical across runs)", async () => {
  // Compile into two different out dirs and compare byte-for-byte.
  const config = await loadConfig(path.join(ROOT, "config.json"));
  const instances = await loadAll(ROOT, config);
  const altOut = path.join(ROOT, ".tmp-compile-out-alt");

  const written1 = await compileInstance(instances["tiny-repo"], ROOT, OUT, PLATFORMS);
  const snapshot1 = {};
  for (const relPath of written1) {
    snapshot1[relPath.replace(/^\.tmp-compile-out\//, "")] = await readFile(path.join(ROOT, relPath));
  }

  const written2 = await compileInstance(instances["tiny-repo"], ROOT, altOut, PLATFORMS);
  assert.equal(written2.length, written1.length);
  for (const relPath of written2) {
    const key = relPath.replace(/^\.tmp-compile-out-alt\//, "");
    const content = await readFile(path.join(ROOT, relPath));
    assert.ok(key in snapshot1, `unexpected artifact ${key} on second run`);
    // assert.equal would compare Buffers by reference; use deep equality on content.
    assert.deepEqual(content, snapshot1[key], `artifact ${key} differs between runs`);
  }

  await rm(altOut, { recursive: true, force: true });
});

test("tier-0 SKILL.md stays within the line budget and contains the trigger table", async () => {
  await compileTiny();
  const text = await readFile(path.join(OUT, "tiny-repo/copilot/agent-skills.SKILL.md"), "utf8");
  const lines = text.trimEnd().split("\n");
  assert.ok(lines.length <= 20, `tier-0 is ${lines.length} lines (budget 20)`);
  for (const category of ["architecture", "security", "testing"]) {
    assert.match(text, new RegExp(`/tiny-repo-${category}`), `trigger table should reference /tiny-repo-${category}`);
  }
});

test("tier-1 skill bodies contain tier-1 rules and a pointer to the tier-2 ref doc", async () => {
  await compileTiny();
  const arch = await readFile(path.join(OUT, "tiny-repo/copilot/skills/architecture.SKILL.md"), "utf8");
  assert.match(arch, /arch-route-registration/);
  assert.match(arch, /ref\/architecture\.md/);
  // tier-2 rule ids must not appear inline in the skill body
  assert.doesNotMatch(arch, /arch-swr-semantics/);
});

test("tier-2 ref docs contain full evidence anchors", async () => {
  await compileTiny();
  const security = await readFile(path.join(OUT, "tiny-repo/copilot/ref/security.md"), "utf8");
  assert.match(security, /sec-csp-policy/);
  assert.match(security, /`grep`: `src\/security\.js :: default-src 'none'`/);
  assert.match(security, /`doc`: `docs\/architecture\.md`/);
});

test("AGENTS.md references category files relatively", async () => {
  await compileTiny();
  const text = await readFile(path.join(OUT, "tiny-repo/agents-md/AGENTS.md"), "utf8");
  for (const category of ["architecture", "security", "testing"]) {
    assert.match(text, new RegExp(`docs/agent-rules/${category}\\.md`));
  }
});

test("compile re-runs are idempotent on the same out dir (no leftover files)", async () => {
  await compileTiny();
  // Plant a stray file that a previous, older corpus might have left behind.
  const stray = path.join(OUT, "tiny-repo/copilot/ref/ghost.md");
  await mkdir(path.dirname(stray), { recursive: true });
  await writeFile(stray, "stale\n");

  await compileTiny();
  const after = await collectRel(OUT);
  assert.ok(!after.includes("tiny-repo/copilot/ref/ghost.md"), "stale artifact should be removed on recompile");
  // The expected full set (minus the ghost) should be exactly what remains.
  for (const expected of [
    "tiny-repo/copilot/agent-skills.SKILL.md",
    "tiny-repo/copilot/skills/architecture.SKILL.md",
    "tiny-repo/copilot/ref/security.md",
    "tiny-repo/agents-md/AGENTS.md",
  ]) {
    assert.ok(after.includes(expected), `expected ${expected} to survive recompile`);
  }
});

async function collectRel(dir) {
  const out = [];
  async function walk(d, rel) {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(d, entry.name), r);
      else out.push(r);
    }
  }
  await walk(dir, "");
  return out.sort();
}
