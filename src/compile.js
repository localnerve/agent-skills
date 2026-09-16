// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * compile.js — rules -> per-platform skill artifacts (deterministic).
 *
 * Usage:
 *   node src/compile.js [--config <path>] [--instance <name>]... [--platform copilot,agents-md]
 *
 * Determinism contract: stable ordering everywhere, no timestamps or absolute
 * paths in output, so repeated runs produce byte-identical artifacts.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadAll, loadConfig } from "./lib/loaders.js";
import { renderAgentsMd, renderCategoryRules } from "./lib/emitters/agents-md.js";
import {
  renderCategoryInstructions,
  renderCategorySkill,
  renderRefDoc,
  renderTier0,
} from "./lib/emitters/copilot.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { config: path.join(ROOT, "config.json"), instances: null, platforms: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--config") args.config = path.resolve(argv[++i]);
    else if (a === "--instance") args.instances = [...(args.instances ?? []), argv[++i]];
    else if (a === "--platform") args.platforms = argv[++i].split(",").map((s) => s.trim());
    else {
      console.error(`compile: unknown argument "${a}"`);
      process.exit(2);
    }
  }
  return args;
}

/** Compile one instance for all requested platforms; returns list of written paths. */
export async function compileInstance(instance, rootDir, outBaseDir, platforms) {
  const { instanceName, dir: rulesDir, index, rulesByCategory } = instance;
  const outDir = path.join(outBaseDir, instanceName);
  await rm(outDir, { recursive: true, force: true });

  const written = [];
  const categories = Object.keys(rulesByCategory).sort();

  if (platforms.includes("copilot")) {
    const copilotDir = path.join(outDir, "copilot");
    const skillDir = path.join(copilotDir, "skills");
    const refDir = path.join(copilotDir, "ref");
    written.push(
      await writeOut(path.join(copilotDir, "agent-skills.SKILL.md"), renderTier0(instanceName, index)),
    );
    for (const category of categories) {
      const rules = sortRules(rulesByCategory[category]);
      written.push(
        await writeOut(path.join(skillDir, `${category}.SKILL.md`), renderCategorySkill(instanceName, index, category, rules)),
      );
      written.push(
        await writeOut(path.join(skillDir, `${category}.instructions.md`), renderCategoryInstructions(instanceName, category, rules)),
      );
      written.push(await writeOut(path.join(refDir, `${category}.md`), renderRefDoc(instanceName, category, rules)));
    }
  }

  if (platforms.includes("agents-md")) {
    const agentsDir = path.join(outDir, "agents-md");
    written.push(await writeOut(path.join(agentsDir, "AGENTS.md"), renderAgentsMd(instanceName, index)));
    for (const category of categories) {
      const rules = sortRules(rulesByCategory[category]);
      written.push(
        await writeOut(
          path.join(agentsDir, "docs", "agent-rules", `${category}.md`),
          renderCategoryRules(instanceName, category, rules),
        ),
      );
    }
  }

  // Keep the corpus source path resolvable for tooling; not part of output.
  void rulesDir;
  // Return location-agnostic paths: "<outBase basename>/<instanceName>/...".
  const base = path.basename(outBaseDir);
  return written.map((p) => `${base}/${path.relative(outBaseDir, p).split(path.sep).join("/")}`);
}

function sortRules(rules) {
  return [...rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function writeOut(absPath, content) {
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, content, "utf8");
  return absPath;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const config = await loadConfig(args.config);
  const instances = await loadAll(ROOT, config);

  const names = args.instances ?? Object.keys(instances).sort();
  for (const name of names) {
    const instance = instances[name];
    if (!instance) {
      console.error(`compile: unknown instance "${name}" (not in config.instances)`);
      process.exit(1);
    }
    if (instance.problems.length > 0) {
      console.error(`compile: corpus validation failed for "${name}":`);
      for (const p of instance.problems) console.error(`  - ${p}`);
      process.exit(1);
    }
  }

  const platforms = args.platforms ?? config.platforms ?? ["copilot", "agents-md"];
  const outBaseDir = path.join(ROOT, "out");
  let total = 0;
  for (const name of names) {
    const written = await compileInstance(instances[name], ROOT, outBaseDir, platforms);
    for (const rel of written) console.log(`compile: wrote ${rel}`);
    total += written.length;
  }
  console.log(`compile: ${total} artifact(s) for [${names.join(", ")}]`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
