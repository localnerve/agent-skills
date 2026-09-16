// SPDX-License-Identifier: AGPL-3.0-or-later
/** Corpus and config loading, relative to the agent-skills root directory. */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { validateCorpus } from "./rule-schema.js";

/** Read and parse the top-level config.json (or a custom path). */
export async function loadConfig(configPath) {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

/**
 * Load one repo instance: its index.json plus every <category>.rules.json.
 * Returns { instanceName, index, rulesByCategory, problems } where problems
 * are schema-level validation errors for this corpus.
 */
export async function loadInstance(rootDir, instanceName) {
  const dir = path.join(rootDir, "rules", instanceName);
  const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  const rulesByCategory = {};
  const entries = (await readdir(dir)).sort();
  for (const entry of entries) {
    if (!entry.endsWith(".rules.json")) continue;
    const category = entry.slice(0, -".rules.json".length);
    rulesByCategory[category] = JSON.parse(await readFile(path.join(dir, entry), "utf8"));
  }
  const problems = validateCorpus(instanceName, index, rulesByCategory);
  return { instanceName, dir, index, rulesByCategory, problems };
}

/** Load every instance named in config.instances that exists under rules/. */
export async function loadAll(rootDir, config) {
  const instances = {};
  for (const name of Object.keys(config?.instances ?? {}).sort()) {
    instances[name] = await loadInstance(rootDir, name);
  }
  return instances;
}
