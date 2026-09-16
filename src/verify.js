// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * verify.js — anchor-drift verification + self-tests of generated outputs.
 *
 * Usage:
 *   node src/verify.js [--config <path>] [--instance <name>]... [--repo <override-path>]
 *
 * For every rule in the instance, each evidence anchor is resolved against the
 * reference repo:
 *   - file:   ref exists as a path in the repo
 *   - symbol: `ref` appears as an identifier in `file` (word-boundary match)
 *   - grep:   `ref` appears literally in `file`
 *   - doc:    ref exists as a path in the repo
 *
 * Broken anchors are reported per rule ID, grouped by durability class
 * (durable drift is an alarm; volatile drift means "re-mine that category").
 * Also checks: emitted artifacts exist, tier-0 SKILL.md stays within the line
 * budget, trigger words are disjoint across categories. Exits non-zero on any
 * failure.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadAll, loadConfig } from "./lib/loaders.js";
import { validateCorpus } from "./lib/rule-schema.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TIER0_LINE_BUDGET = 20;
export const CATEGORY_TIER1_WARN_THRESHOLD = 15;

/** Resolve one evidence anchor against repoRoot. Returns null or a problem string. */
export async function resolveAnchor(anchor, repoRoot) {
  switch (anchor.kind) {
    case "file":
    case "doc": {
      const p = path.join(repoRoot, anchor.ref);
      try {
        await readFile(p); // existence probe; content not needed
        return null;
      } catch {
        return `${anchor.kind} anchor "${anchor.ref}" does not exist in the repo`;
      }
    }
    case "symbol":
    case "grep": {
      let text;
      try {
        text = await readFile(path.join(repoRoot, anchor.file), "utf8");
      } catch {
        return `${anchor.kind} anchor file "${anchor.file}" does not exist in the repo`;
      }
      if (anchor.kind === "grep") {
        return text.includes(anchor.ref) ? null : `grep anchor ${JSON.stringify(anchor.ref)} not found in "${anchor.file}"`;
      }
      const escaped = anchor.ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`);
      return re.test(text) ? null : `symbol "${anchor.ref}" not found in "${anchor.file}"`;
    }
    default:
      return `unknown evidence kind "${anchor.kind}"`;
  }
}

/**
 * Verify one instance. Returns { failures, warnings } where failures are
 * strings that force a non-zero exit and warnings are advisory.
 */
export async function verifyInstance(instance, repoRoot, outBaseDir, platforms) {
  const failures = [];
  const warnings = [];
  const { instanceName, index, rulesByCategory } = instance;

  // Re-validate the corpus as it is *now* (tests may mutate instances after
  // load), not the problems captured at load time.
  failures.push(...validateCorpus(instanceName, index, rulesByCategory).map((p) => `corpus: ${p}`));

  // Anchor resolution, grouped by durability class in the report.
  const drift = { durable: [], volatile: [] };
  for (const category of Object.keys(rulesByCategory).sort()) {
    for (const rule of rulesByCategory[category]) {
      if (!Array.isArray(rule?.evidence)) continue;
      for (const anchor of rule.evidence) {
        const problem = await resolveAnchor(anchor, repoRoot);
        if (problem) drift[rule.durability === "volatile" ? "volatile" : "durable"].push(`${rule.id}: ${problem}`);
      }
    }
  }
  for (const line of drift.durable) failures.push(`drift (durable): ${line}`);
  for (const line of drift.volatile) warnings.push(`drift (volatile, re-mine candidate): ${line}`);

  // Category size advisory.
  for (const [category, rules] of Object.entries(rulesByCategory)) {
    const tier1Count = rules.filter((r) => r.tier === 1).length;
    if (tier1Count > CATEGORY_TIER1_WARN_THRESHOLD) {
      warnings.push(`category "${category}" has ${tier1Count} tier-1 rules (> ${CATEGORY_TIER1_WARN_THRESHOLD}); consider splitting into sub-categories`);
    }
  }

  // Artifact checks against out/.
  const outDir = path.join(outBaseDir, instanceName);
  for (const platform of platforms) {
    if (platform === "copilot") {
      const tier0Path = path.join(outDir, "copilot", "agent-skills.SKILL.md");
      const text = await safeRead(tier0Path);
      if (text === null) failures.push("artifact: missing emitted copilot/agent-skills.SKILL.md (run skills:compile first)");
      else {
        const lineCount = text.trimEnd().split("\n").length;
        if (lineCount > TIER0_LINE_BUDGET) {
          failures.push(`tier-0 budget: agent-skills.SKILL.md is ${lineCount} lines (budget ${TIER0_LINE_BUDGET})`);
        }
      }
      for (const category of Object.keys(rulesByCategory).sort()) {
        for (const rel of [`copilot/skills/${category}.SKILL.md`, `copilot/ref/${category}.md`]) {
          if ((await safeRead(path.join(outDir, rel))) === null) failures.push(`artifact: missing emitted ${rel}`);
        }
      }
    } else if (platform === "agents-md") {
      if ((await safeRead(path.join(outDir, "agents-md", "AGENTS.md"))) === null) {
        failures.push("artifact: missing emitted AGENTS.md (run skills:compile first)");
      }
      for (const category of Object.keys(rulesByCategory).sort()) {
        const rel = `agents-md/docs/agent-rules/${category}.md`;
        if ((await safeRead(path.join(outDir, rel))) === null) failures.push(`artifact: missing emitted ${rel}`);
      }
    }
  }

  void index;
  return { instanceName, failures, warnings };
}

async function safeRead(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = { config: path.join(ROOT, "config.json"), instances: null, repoOverride: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--config") args.config = path.resolve(argv[++i]);
    else if (a === "--instance") args.instances = [...(args.instances ?? []), argv[++i]];
    else if (a === "--repo") args.repoOverride = path.resolve(argv[++i]);
    else {
      console.error(`verify: unknown argument "${a}"`);
      process.exit(2);
    }
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const config = await loadConfig(args.config);
  const instances = await loadAll(ROOT, config);
  const platforms = config.platforms ?? ["copilot", "agents-md"];

  const names = args.instances ?? Object.keys(instances).sort();
  let exitCode = 0;
  for (const name of names) {
    const instance = instances[name];
    if (!instance) {
      console.error(`verify: unknown instance "${name}"`);
      process.exit(2);
    }
    const repoRoot = args.repoOverride ?? path.resolve(ROOT, config.instances[name].repoPath);
    const result = await verifyInstance(instance, repoRoot, path.join(ROOT, "out"), platforms);

    console.log(`verify: ${name} — repo at ${path.relative(ROOT, repoRoot)}`);
    for (const w of result.warnings) console.warn(`verify: warning: ${w}`);
    if (result.failures.length === 0) {
      console.log("verify: OK");
    } else {
      exitCode = 1;
      for (const f of result.failures) console.error(`verify: FAIL: ${f}`);
    }
  }
  process.exit(exitCode);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
