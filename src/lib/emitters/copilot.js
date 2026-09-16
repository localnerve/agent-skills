// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * VS Code Copilot emitter: renders SKILL.md + .instructions.md artifacts.
 *
 * Layout under <outDir>/copilot/:
 *   agent-skills.SKILL.md              tier 0 (always resident; line-budgeted)
 *   skills/<category>.SKILL.md         tier 1 per-category skills
 *   skills/<category>.instructions.md  applyTo-scoped instruction companion
 *   ref/<category>.md                  tier 2 reference docs with evidence anchors
 */

/** Render the tier-0 always-resident SKILL.md body (frontmatter included). */
export function renderTier0(instanceName, index) {
  const lines = [];
  lines.push("---");
  lines.push(`name: ${instanceName}-core`);
  lines.push(
    `description: Core disciplines and trigger table for the ${instanceName} reference repo. Load category skills when task words match the trigger table.`,
  );
  lines.push("applyTo: **/*");
  lines.push("---");
  lines.push("");
  lines.push(`# ${instanceName}: core disciplines`);
  lines.push("");
  for (const d of index.tier0.disciplines) lines.push(`- ${d}`);
  lines.push("");
  lines.push("## Trigger table");
  lines.push("");
  lines.push("| Task words | Skill |");
  lines.push("| --- | --- |");
  const triggers = index.tier0.triggers ?? {};
  for (const category of Object.keys(triggers).sort()) {
    lines.push(`| ${triggers[category].join(", ")} | \`/${instanceName}-${category}\` |`);
  }
  return lines.join("\n") + "\n";
}

/** Render a tier-1 per-category SKILL.md (frontmatter included). */
export function renderCategorySkill(instanceName, index, category, rules) {
  const tier1 = rules.filter((r) => r.tier === 1);
  const tier2 = rules.filter((r) => r.tier === 2);
  const lines = [];
  lines.push("---");
  lines.push(`name: ${instanceName}-${category}`);
  const triggerWords = index?.tier0?.triggers?.[category] ?? tier1.flatMap((r) => r.triggers);
  lines.push(
    `description: ${capitalize(category)} rules for the ${instanceName} reference repo. Trigger words: ${triggerWords.join(", ") || "none"}.`,
  );
  lines.push("applyTo: **/*");
  lines.push("---");
  lines.push("");
  lines.push(`# ${instanceName}: ${category}`);
  lines.push("");
  for (const rule of tier1) {
    lines.push(`- **${rule.id}** — ${rule.instruction}`);
  }
  if (tier2.length > 0) {
    lines.push("");
    lines.push(
      `Deeper context: read \`agent-skills/out/${instanceName}/copilot/ref/${category}.md\` when the task needs more than the rules above.`,
    );
  }
  return lines.join("\n") + "\n";
}

/** Render a tier-1 .instructions.md companion (same body, instruction style). */
export function renderCategoryInstructions(instanceName, category, rules) {
  const tier1 = rules.filter((r) => r.tier === 1);
  const lines = [];
  lines.push(`# ${instanceName}: ${category} instructions`);
  lines.push("");
  for (const rule of tier1) {
    lines.push(`${rule.instruction}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render a tier-2 reference doc: full rule entries with evidence anchors. */
export function renderRefDoc(instanceName, category, rules) {
  const tier2 = rules.filter((r) => r.tier === 2);
  const lines = [];
  lines.push(`# ${instanceName}: ${category} — reference`);
  lines.push("");
  lines.push("Tier-2 rules with evidence anchors. Anchors are relative to the reference repo root and are checked by `skills:check`.");
  lines.push("");
  if (tier2.length === 0) {
    lines.push("_No tier-2 rules for this category._");
  }
  for (const rule of tier2) {
    lines.push(`## ${rule.id}`);
    lines.push("");
    lines.push(`_(${rule.durability}, ${rule.status})_`);
    lines.push("");
    lines.push(rule.instruction);
    lines.push("");
    lines.push("Evidence:");
    for (const ev of rule.evidence) {
      const anchor = ev.file ? `${ev.file} :: ${ev.ref}` : ev.ref;
      lines.push(`- \`${ev.kind}\`: \`${anchor}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
