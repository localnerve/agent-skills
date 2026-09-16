// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rule entry shape (the contract) and validation for the curated rule corpus.
 *
 * Each rule: { id, tier (1|2), category, instruction, triggers: string[],
 *   evidence: [{ kind: 'file'|'symbol'|'grep'|'doc', ref, file? }],
 *   durability: 'durable'|'volatile', platforms?: object, status: 'active'|'experimental' }.
 *
 * - tier 1 rules are compiled into per-category skill bodies.
 * - tier 2 rules stay in reference docs; skills contain a pointer to them.
 * - evidence anchors must resolve against the reference repo (see verify.js).
 */

export const DURABILITIES = Object.freeze(["durable", "volatile"]);
export const STATUSES = Object.freeze(["active", "experimental"]);
export const EVIDENCE_KINDS = Object.freeze(["file", "symbol", "grep", "doc"]);

/**
 * Validate one rule entry. Returns an array of human-readable problem strings
 * (empty when the rule is valid).
 */
export function validateRule(rule, pathLabel = "<rule>") {
  const problems = [];
  if (!isNonEmptyString(rule?.id)) problems.push(`${pathLabel}: missing or empty "id"`);
  if (rule?.tier !== 1 && rule?.tier !== 2) problems.push(`${pathLabel}: "tier" must be 1 or 2`);
  if (!isNonEmptyString(rule?.category)) problems.push(`${pathLabel}: missing or empty "category"`);
  if (!isNonEmptyString(rule?.instruction)) problems.push(`${pathLabel}: missing or empty "instruction"`);
  if (!Array.isArray(rule?.triggers) || rule.triggers.some((t) => !isNonEmptyString(t))) {
    problems.push(`${pathLabel}: "triggers" must be an array of non-empty strings`);
  }
  if (rule?.durability !== "durable" && rule?.durability !== "volatile") {
    problems.push(`${pathLabel}: "durability" must be one of ${DURABILITIES.join("|")}`);
  }
  if (rule?.status !== "active" && rule?.status !== "experimental") {
    problems.push(`${pathLabel}: "status" must be one of ${STATUSES.join("|")}`);
  }
  if (!Array.isArray(rule?.evidence) || rule.evidence.length === 0) {
    problems.push(`${pathLabel}: "evidence" must be a non-empty array`);
  } else {
    rule.evidence.forEach((ev, i) => {
      const label = `${pathLabel}.evidence[${i}]`;
      if (!EVIDENCE_KINDS.includes(ev?.kind)) {
        problems.push(`${label}: "kind" must be one of ${EVIDENCE_KINDS.join("|")}`);
      }
      if (!isNonEmptyString(ev?.ref)) problems.push(`${label}: missing or empty "ref"`);
      if ((ev?.kind === "symbol" || ev?.kind === "grep") && !isNonEmptyString(ev?.file)) {
        problems.push(`${label}: kind "${ev?.kind}" requires a "file" to anchor in`);
      }
    });
  }
  return problems;
}

/**
 * Validate a whole corpus: index + per-category rule arrays. Returns problem strings.
 * Enforces unique rule IDs, category files matching declared categories, and
 * trigger-word disjointness across categories (index-level triggers).
 */
export function validateCorpus(instanceName, index, rulesByCategory) {
  const problems = [];
  if (!isNonEmptyString(index?.instance)) problems.push(`index.json: missing "instance"`);
  else if (index.instance !== instanceName) {
    problems.push(`index.json: "instance" is ${JSON.stringify(index.instance)} but the directory is "${instanceName}"`);
  }
  if (!Array.isArray(index?.categories) || index.categories.length === 0) {
    problems.push("index.json: \"categories\" must be a non-empty array");
    return problems;
  }
  const tier0 = index.tier0 ?? {};
  if (!Array.isArray(tier0.disciplines) || tier0.disciplines.length === 0) {
    problems.push("index.json: tier0.disciplines must be a non-empty array");
  }
  if (typeof tier0.triggers !== "object" || tier0.triggers === null || Array.isArray(tier0.triggers)) {
    problems.push("index.json: tier0.triggers must be an object mapping category -> trigger words");
  }

  const declared = new Set(index.categories);
  for (const [fileCategory, rules] of Object.entries(rulesByCategory)) {
    if (!declared.has(fileCategory)) {
      problems.push(`rules file "${fileCategory}.rules.json": category not declared in index.json`);
    }
    if (!Array.isArray(rules)) {
      problems.push(`rules file "${fileCategory}.rules.json": expected an array of rules`);
      continue;
    }
    for (const rule of rules) {
      if (rule?.category !== fileCategory) {
        problems.push(`${rule?.id ?? "<unknown>"}: category ${JSON.stringify(rule?.category)} does not match its file "${fileCategory}.rules.json"`);
      }
      problems.push(...validateRule(rule, rule?.id ?? `<rule in ${fileCategory}>`));
    }
  }

  const allRules = Object.values(rulesByCategory)
    .filter((rules) => Array.isArray(rules))
    .flat();
  const seen = new Set();
  for (const rule of allRules) {
    if (seen.has(rule?.id)) problems.push(`duplicate rule id "${rule.id}"`);
    seen.add(rule?.id);
  }

  // Trigger-word disjointness across categories (index-level trigger table).
  const wordToCategory = new Map();
  for (const [category, words] of Object.entries(tier0.triggers ?? {})) {
    if (!declared.has(category)) problems.push(`index.json: tier0.triggers references undeclared category "${category}"`);
    for (const word of words) {
      const existing = wordToCategory.get(word);
      if (existing && existing !== category) {
        problems.push(`trigger word "${word}" maps to both categories "${existing}" and "${category}"; triggers must be disjoint`);
      }
      wordToCategory.set(word, category);
    }
  }

  return problems;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
