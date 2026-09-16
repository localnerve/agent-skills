// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Generic AGENTS.md emitter: one AGENTS.md (tier 0 + trigger table) plus
 * per-category rule files referenced relatively from it.
 *
 * Layout under <outDir>/agents-md/:
 *   AGENTS.md
 *   docs/agent-rules/<category>.md     tier 1 rules + tier 2 reference entries
 */

/** Render the top-level AGENTS.md (tier 0 always-resident text). */
export function renderAgentsMd(instanceName, index) {
  const lines = [];
  lines.push(`# Agent rules: ${instanceName}`);
  lines.push("");
  lines.push("## Core disciplines");
  lines.push("");
  for (const d of index.tier0.disciplines) lines.push(`- ${d}`);
  lines.push("");
  lines.push("## Category rules");
  lines.push("");
  const triggers = index.tier0.triggers ?? {};
  for (const category of Object.keys(triggers).sort()) {
    const words = triggers[category].join(", ");
    lines.push(`- **${category}** (${words}) — see [docs/agent-rules/${category}.md](docs/agent-rules/${category}.md)`);
  }
  return lines.join("\n") + "\n";
}

/** Render a per-category rules file (tier 1 inline, tier 2 with anchors). */
export function renderCategoryRules(instanceName, category, rules) {
  const tier1 = rules.filter((r) => r.tier === 1);
  const tier2 = rules.filter((r) => r.tier === 2);
  const lines = [];
  lines.push(`# ${instanceName}: ${category}`);
  lines.push("");
  for (const rule of tier1) {
    lines.push(`- **${rule.id}** — ${rule.instruction}`);
  }
  if (tier2.length > 0) {
    lines.push("");
    lines.push("## Reference (with evidence anchors, repo-relative)");
    lines.push("");
    for (const rule of tier2) {
      lines.push(`### ${rule.id} _(${rule.durability}, ${rule.status})_`);
      lines.push("");
      lines.push(rule.instruction);
      lines.push("");
      for (const ev of rule.evidence) {
        const anchor = ev.file ? `${ev.file} :: ${ev.ref}` : ev.ref;
        lines.push(`- \`${ev.kind}\`: \`${anchor}\``);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
