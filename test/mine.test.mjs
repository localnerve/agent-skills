// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from "node:assert/strict";
import { test } from "node:test";

import { loadInstance } from "../src/lib/loaders.js";
import { renderMiningPrompt, validateMiningDoc } from "../src/mine.js";

const ROOT = new URL("..", import.meta.url).pathname;
const instance = await loadInstance(ROOT, "tiny-repo");
assert.equal(instance.problems.length, 0, `fixture corpus must be valid: ${instance.problems.join("; ")}`);

test("prompt contains repo path, existing rule ids, and the schema field list", () => {
  const prompt = renderMiningPrompt(instance, "test/fixtures/tiny-repo");
  assert.ok(prompt.includes("`test/fixtures/tiny-repo`"), "repo path present");
  for (const id of ["arch-route-registration", "arch-error-envelope", "test-colocated-node-test", "sec-escape-untrusted"]) {
    assert.ok(prompt.includes(id), `existing rule id ${id} present for dedup`);
  }
  for (const field of ["id", "tier", "category", "instruction", "triggers", "evidence", "durability", "status"]) {
    assert.ok(new RegExp(`^\\s{2}${field}:`, "m").test(prompt), `schema field ${field} listed`);
  }
  for (const kind of ["file", "symbol", "grep", "doc"]) {
    assert.ok(prompt.includes(`kind "${kind}"`), `evidence kind ${kind} documented`);
  }
});

test("prompt is deterministic across calls", () => {
  const a = renderMiningPrompt(instance, "test/fixtures/tiny-repo");
  const b = renderMiningPrompt(instance, "test/fixtures/tiny-repo");
  assert.deepEqual(a, b);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(a), "no timestamps in prompt");
});

test("prompt requires suggested_categories and the output shape", () => {
  const prompt = renderMiningPrompt(instance, "test/fixtures/tiny-repo");
  assert.ok(prompt.includes('"suggested_categories"'));
  assert.ok(prompt.includes('"proposed_rules"'));
  assert.ok(prompt.includes('"rationale"'));
  assert.ok(prompt.includes('"diff_target"'));
});

test("prompt lists existing categories", () => {
  const prompt = renderMiningPrompt(instance, "test/fixtures/tiny-repo");
  for (const category of ["architecture", "testing", "security"]) {
    assert.match(prompt, new RegExp(`^- ${category}$`, "m"));
  }
});

test("validateMiningDoc accepts a well-formed proposal", () => {
  const doc = {
    suggested_categories: ["architecture"],
    proposed_rules: [
      {
        id: "arch-ports-no-magic-numbers",
        tier: 2,
        category: "architecture",
        instruction: "Reference the exported PORT constant instead of hard-coding port numbers.",
        triggers: ["port"],
        evidence: [{ kind: "symbol", ref: "PORT", file: "src/server.js" }],
        durability: "volatile",
        status: "experimental",
        rationale: "Observed PORT = 8787 exported from src/server.js; callers should not hard-code it.",
        diff_target: "new",
      },
    ],
  };
  const { problems, rules } = validateMiningDoc(doc, instance);
  assert.deepEqual(problems, []);
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0]._problems, []);
});

test("validateMiningDoc flags malformed proposed rules", () => {
  const doc = {
    suggested_categories: ["architecture"],
    proposed_rules: [
      {
        id: "arch-bad",
        tier: 3, // invalid tier
        category: "architecture",
        instruction: "", // empty
        triggers: [],
        evidence: [{ kind: "quantum", ref: "x" }], // bad evidence kind + missing file
        durability: "eternal", // invalid
        status: "active",
        rationale: "has a rationale",
        diff_target: "update:arch-does-not-exist", // unknown target
      },
    ],
  };
  const { problems, rules } = validateMiningDoc(doc, instance);
  const first = rules[0]._problems;
  assert.ok(first.some((p) => p.includes('"tier" must be 1 or 2')));
  assert.ok(first.some((p) => p.includes('missing or empty "instruction"')));
  assert.ok(first.some((p) => p.includes('"kind" must be one of file|symbol|grep|doc')));
  assert.ok(first.some((p) => p.includes('"durability" must be one of durable|volatile')));
  assert.ok(first.some((p) => p.includes('unknown rule id "arch-does-not-exist"')));
  assert.deepEqual(problems, []);
});

test("validateMiningDoc flags invalid documents and duplicate ids", () => {
  const bad = validateMiningDoc(null, instance);
  assert.ok(bad.problems.some((p) => p.includes("expected a JSON object")));

  const noRules = validateMiningDoc({ suggested_categories: "nope", proposed_rules: "nope" }, instance);
  assert.ok(noRules.problems.some((p) => p.includes('"proposed_rules" must be an array')));

  const dup = validateMiningDoc(
    {
      suggested_categories: ["architecture"],
      proposed_rules: [
        rule("arch-x"),
        rule("arch-x"),
      ],
    },
    instance,
  );
  assert.ok(dup.problems.some((p) => p.includes('duplicate proposed rule id "arch-x"')));
});

test("validateMiningDoc flags rules in undeclared categories", () => {
  const doc = {
    suggested_categories: [],
    proposed_rules: [rule("perf-1", "performance")],
  };
  const { rules } = validateMiningDoc(doc, instance);
  assert.ok(rules[0]._problems.some((p) => p.includes('category "performance"')));
});

function rule(id, category = "architecture") {
  return {
    id,
    tier: 1,
    category,
    instruction: "Do the thing.",
    triggers: ["thing"],
    evidence: [{ kind: "file", ref: "src/server.js" }],
    durability: "durable",
    status: "active",
    rationale: "observed it",
    diff_target: "new",
  };
}
