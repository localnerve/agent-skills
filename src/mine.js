// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * mine.js — Phase D: LLM mining hybrid (prompt renderer + proposal validator).
 *
 * Two concerns, both deterministic and side-effect free:
 *   1. renderMiningPrompt(instance, repoPath) -> the subagent prompt that scans
 *      a reference repo (code + docs) and returns candidate rules in the rule
 *      JSON shape as a *diff proposal* for a human to merge into rules/.
 *   2. validateMiningDoc(doc) -> in-process check of a returned proposal so
 *      obviously malformed candidates are flagged before a human ever sees them.
 *
 * This tool NEVER writes rules. Output is a document:
 *   { suggested_categories: string[], proposed_rules: [{ ...rule, rationale, diff_target }] }
 * where diff_target is "new" or "update:<existing-rule-id>".
 *
 * Usage:
 *   node src/mine.js [--config <path>] --instance <name> [--repo <path>]
 *     renders the prompt to stdout (deterministic; no timestamps/abs paths).
 *   node src/mine.js --validate <proposal.json> [--instance <name>]
 *     validates a proposal document; exit 1 if any proposed rule is malformed.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadAll, loadConfig } from "./lib/loaders.js";
import { DURABILITIES, STATUSES, validateRule } from "./lib/rule-schema.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The rule contract, rendered verbatim so the miner's output is machine-checkable. */
export function renderSchemaContract() {
  return [
    "Each proposed rule MUST be a JSON object with exactly these fields:",
    `  id: string (unique, kebab-case, prefixed by its category e.g. "arch-...")`,
    `  tier: 1 | 2 (1 = compiled into the per-category skill body; 2 = reference doc only)`,
    `  category: string (one of the categories below, or a newly suggested one)`,
    `  instruction: string (agent-facing imperative sentence(s); no repo-specific narration)`,
    `  triggers: string[] (lowercase words/phrases that should activate this rule; keep disjoint from other categories where possible)`,
    `  evidence: [ { kind, ref, file? } ] — non-empty array of anchors into the reference repo:`,
    `      kind "file"   -> ref is a repo-relative path that must exist`,
    `      kind "symbol" -> ref is an identifier grep-able (word boundary) in "file"`,
    `      kind "grep"   -> ref is a literal substring found in "file"`,
    `      kind "doc"    -> ref is a repo-relative doc path that must exist`,
    `  durability: "${DURABILITIES.join(" | ")}" (durable = practice-level, survives refactors; volatile = implementation-anchored, expected to churn)`,
    `  status: "${STATUSES.join(" | ")}"`,
    `  (optional) platforms: object`,
    "Every evidence anchor MUST point at something you actually observed while scanning — never invent paths or symbols.",
  ].join("\n");
}

/** Compact list of existing rules for deduplication: ids + instructions only. */
export function renderExistingRules(instance) {
  const lines = [];
  for (const category of Object.keys(instance.rulesByCategory).sort()) {
    for (const rule of [...instance.rulesByCategory[category]].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      lines.push(`- [${rule.category}] ${rule.id}: ${rule.instruction}`);
    }
  }
  return lines.join("\n");
}

/**
 * Render the full mining subagent prompt. Deterministic: same inputs -> same
 * bytes. The repo path is passed through as given (callers should pass a path
 * that is acceptable to include in output; tests use relative paths).
 */
export function renderMiningPrompt(instance, repoPath) {
  const { instanceName } = instance;
  const categories = Object.keys(instance.rulesByCategory).sort();
  return [
    `You are mining the reference repository at \`${repoPath}\` for durable engineering practices.`,
    `Your output is a JSON diff proposal for a human to review and merge into the curated rule corpus (instance "${instanceName}"). You never write rule files; you only propose.`,
    ``,
    `## Task`,
    `1. Scan the repo's source code AND its docs/ directory (read-only). Prefer reading over guessing.`,
    `2. Identify practices worth encoding as agent rules: conventions a competent developer would otherwise miss, and invariants that break if violated. Prefer practice-level (durable) rules; mark implementation-specific ones volatile.`,
    `3. Propose a category taxonomy FIRST, then the rules. Reuse existing categories where they fit; suggest new ones only when a cluster of rules clearly does not belong to any existing category.`,
    `4. Do NOT re-propose anything already covered by an existing rule (list below). If you believe an existing rule is stale or wrong, propose diff_target "update:<rule-id>" with the corrected instruction instead.`,
    ``,
    `## Existing categories`,
    ...categories.map((c) => `- ${c}`),
    ``,
    `## Existing rules (deduplicate against these)`,
    renderExistingRules(instance),
    ``,
    `## Rule schema (your proposed_rules entries MUST match this exactly)`,
    renderSchemaContract(),
    ``,
    `## Output shape (respond with ONLY this JSON document, no prose)`,
    `{`,
    `  "suggested_categories": [ "<category>", ... ],`,
    `  "proposed_rules": [`,
    `    {`,
    `      "id": "...", "tier": 1, "category": "...", "instruction": "...",`,
    `      "triggers": ["..."], "evidence": [{ "kind": "file", "ref": "..." }],`,
    `      "durability": "durable", "status": "active",`,
    `      "rationale": "<one or two sentences: why this practice matters and what you observed>",`,
    `      "diff_target": "new | update:<existing-rule-id>"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `## Constraints`,
    `- Evidence anchors must be real paths/identifiers/literals/docs you actually saw; the verifier will reject otherwise.`,
    `- Keep trigger words disjoint across categories when possible (the corpus enforces this).`,
    `- Tier 1 rules are short imperative instructions; put depth in tier 2 with more evidence.`,
    `- If the repo is too small to justify a rule, propose nothing — an empty proposed_rules array is a valid answer.`,
  ].join("\n");
}

/**
 * Validate a mining proposal document. Returns { problems, rules } where
 * problems are human-readable strings and rules is the list of proposed rules
 * (with per-rule validation results attached as rule._problems).
 */
export function validateMiningDoc(doc, instance) {
  const problems = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { problems: ["proposal: expected a JSON object"], rules: [] };
  }
  if (!Array.isArray(doc.suggested_categories) || doc.suggested_categories.some((c) => typeof c !== "string" || !c.trim())) {
    problems.push("proposal: \"suggested_categories\" must be an array of non-empty strings");
  }
  if (!Array.isArray(doc.proposed_rules)) {
    problems.push('proposal: "proposed_rules" must be an array');
    return { problems, rules: [] };
  }

  const knownIds = new Set();
  for (const category of Object.keys(instance?.rulesByCategory ?? {})) {
    for (const rule of instance.rulesByCategory[category]) knownIds.add(rule.id);
  }
  const categories = new Set(Object.keys(instance?.rulesByCategory ?? {}));

  const rules = doc.proposed_rules.map((rule, i) => {
    const label = `proposed_rules[${i}]`;
    const ruleProblems = validateRule(rule, label);
    if (!isNonEmptyString(rule?.rationale)) ruleProblems.push(`${label}: missing or empty "rationale"`);
    const target = rule?.diff_target;
    if (target === "new") {
      // nothing extra
    } else if (typeof target === "string" && target.startsWith("update:")) {
      const refId = target.slice("update:".length);
      if (!knownIds.has(refId)) ruleProblems.push(`${label}: diff_target references unknown rule id "${refId}"`);
    } else {
      ruleProblems.push(`${label}: "diff_target" must be "new" or "update:<existing-rule-id>"`);
    }
    if (rule?.category && instance && !categories.has(rule.category) && !(doc.suggested_categories ?? []).includes(rule.category)) {
      ruleProblems.push(`${label}: category "${rule.category}" is neither an existing category nor in suggested_categories`);
    }
    return { ...rule, _problems: ruleProblems };
  });

  // Duplicate ids among proposals.
  const seen = new Set();
  for (const rule of rules) {
    if (typeof rule.id === "string" && seen.has(rule.id)) {
      problems.push(`duplicate proposed rule id "${rule.id}"`);
    }
    seen.add(rule.id);
  }

  return { problems, rules };
}

function parseArgs(argv) {
  const args = { config: path.join(ROOT, "config.json"), instance: null, repo: null, validate: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--config") args.config = path.resolve(argv[++i]);
    else if (a === "--instance") args.instance = argv[++i];
    else if (a === "--repo") args.repo = argv[++i];
    else if (a === "--validate") args.validate = path.resolve(argv[++i]);
    else {
      console.error(`mine: unknown argument "${a}"`);
      process.exit(2);
    }
  }
  return args;
}

function singleInstance(instances, name) {
  const names = Object.keys(instances).sort();
  if (name) {
    const found = instances[name];
    if (!found) throw new Error(`unknown instance "${name}" (known: ${names.join(", ")})`);
    return found;
  }
  if (names.length !== 1) {
    throw new Error(`multiple instances configured (${names.join(", ")}); pass --instance <name>`);
  }
  return instances[names[0]];
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const config = await loadConfig(args.config);
  const instances = await loadAll(ROOT, config);
  const instance = singleInstance(instances, args.instance);

  if (args.validate) {
    const doc = JSON.parse(await readFile(args.validate, "utf8"));
    const { problems, rules } = validateMiningDoc(doc, instance);
    let failed = false;
    for (const rule of rules) {
      if (rule._problems.length > 0) {
        failed = true;
        console.error(`mine: ${rule.id ?? "<unnamed>"} is malformed:`);
        for (const p of rule._problems) console.error(`    - ${p}`);
      } else {
        console.log(`mine: OK ${rule.id} (${rule.diff_target})`);
      }
    }
    for (const p of problems) console.error(`mine: ${p}`);
    if (failed || problems.length > 0) process.exit(1);
    return;
  }

  const repoPath = args.repo ?? config.instances[instance.instanceName]?.repoPath;
  if (!repoPath) throw new Error("no repo path given and none configured for this instance");
  process.stdout.write(renderMiningPrompt(instance, repoPath));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`mine: ${err.message}`);
    process.exit(1);
  });
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
