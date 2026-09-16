# Plan: Repo-Practice Skill Generator (agent-skills)

## TL;DR
Yes, this is meaningfully achievable — and the key design decision that makes it testable is **inverting provenance**: the practices are *curated data* (a rule corpus with evidence anchors into the source repo), not LLM output. A small deterministic Node program compiles that corpus into tiered skills/prompts for multiple agent platforms, and a verifier checks that every rule's evidence anchor still resolves in the repo. LLM mining is an optional *suggestion* pass that emits diffs for human review — never the source of truth.

Answers to the user's questions:
- **Special agent vs skills?** Consumer side needs no custom agent — VS Code Copilot skills (SKILL.md + .instructions.md) natively support tiering, applyTo scoping, and trigger words; slash commands map 1:1 to category skills. A generic AGENTS.md emitter covers Claude Code / other agents. The only "agent" is an optional subagent prompt used for the mining pass.
- **Re-run on every repo change?** No. Rules are data; regeneration happens when the rule corpus changes (rare). What runs often is a cheap `skills:check` anchor-drift verification (seconds, deterministic): it fails if a rule's evidence file/symbol/grep no longer exists in the repo, flagging stale rules for review.
- **How to test adherence?** Three tiers: (1) unit tests of compiler+verifier against fixture repos; (2) anchor-drift check as ongoing guard; (3) behavioral "golden task" conformance evals — small tasks whose expected outputs are checklists of rule IDs, executed by an agent given ONLY the generated skills, scored on checklist coverage.

## Decisions (from user)
- Multi-platform from day one: emitters for VS Code Copilot (primary), generic AGENTS.md; template-engine style so more platforms can be added.
- **Fully generic tool, no jam-build baked in** (revised 2026-09-16): jam-build has major architecture changes on the horizon (BFF + Caddy proxy replacing client-baked AUTHZ_URL/AUTHZ_CLIENT_ID; data schema redesign per `docs/data-redesign-analysis.md` affecting IndexedDB tables). Baking a curated jam-build corpus now means paying curation cost for rules that will churn. The tool ships repo-agnostic; jam-build serves only as (a) test subject for the tools and (b) a future second corpus instance, bootstrapped via the mining pass AFTER the redesign lands.
- Hybrid provenance: curated rule files are source of truth; LLM mining proposes new/updated rules as reviewable diffs.
- Rule schema gains `durability: durable|volatile`: durable = practice-level (survives architecture changes); volatile = implementation-anchored (expected to churn; broken anchor = re-mine that category, not an alarm). Verifier reports drift separately per durability class.

## Architecture

```
agent-skills/                      # standalone, copyable to any machine/repo
  package.json                     # ESM, no deps (pure node), "type": "module"
  config.example.json              # { repoPath, outDir, platforms: [...] }
  rules/                           # THE source of truth (curated data)
    <repo-instance>/               # one dir per reference repo, e.g. "tiny-repo" (fixture), later "jam-build"
      index.json                   # repo metadata, tier-0 summary text, trigger table
      <category>.rules.json        # categories are open-ended per repo (architecture, testing, ...)
  src/
    compile.js                     # rules -> per-platform skill artifacts (deterministic)
    verify.js                      # anchor-drift verification + self-tests of outputs
    mine.js                        # optional: renders the LLM-mining subagent prompt
    lib/rule-schema.js             # shared rule entry shape (JSDoc-typed)
    lib/emitters/copilot.js        # SKILL.md + .instructions.md emitter
    lib/emitters/agents-md.js      # AGENTS.md + nested refs emitter
  test/
    fixtures/tiny-repo/            # miniature repo for anchor/compiler tests
    compile.test.mjs               # node:test based (no new deps needed)
    verify.test.mjs
  out/                             # generated artifacts (git-ignored or committed?)
    copilot/...  agents-md/...
```

### Rule entry shape (the contract)
Each rule: `{ id, tier (1|2), category, instruction (agent-facing imperative sentence(s)), triggers: [words/phrases], evidence: [{kind: file|symbol|grep|doc, ref}], durability: durable|volatile, platforms?: {copilot?...}, status: active|experimental }`.
- `tier 1` rules are compiled into per-category SKILL.md bodies.
- `tier 2` rules stay in reference docs; category skills contain a pointer ("read `agent-skills/out/copilot/ref/security.md` when doing X").
- `index.json` holds the tier-0 always-resident text (≤ ~15 lines): core disciplines + trigger→category table.

### Tiered output design (Copilot)
- **Tier 0 — always resident**: one small SKILL.md (~10–15 lines) with the repo's non-negotiable disciplines plus a trigger table: `service worker|sw.` → `/offline-sw`, `csp|trusted types` → `/security`, `test|coverage` → `/testing`, etc.
- **Tier 1 — per-category skills**: one SKILL.md per category (~30–60 lines of tier-1 rules); activated by slash command or trigger words in user requests. Categories are open-ended per repo instance.
- **Tier 2 — reference docs**: full rule entries with evidence anchors (file + symbol + doc pointer), loaded only when a task needs depth.
- AGENTS.md emitter: same tiers as one AGENTS.md (tier 0 + table) plus `docs/agent-rules/<category>.md` files referenced relatively.

### Generator program behavior
- `node agent-skills/src/compile.js --repo <path> --config agent-skills/config.json [--platform copilot,agents-md]` → renders out/. Deterministic (stable ordering, no timestamps) so output is diff-able and snapshot-testable.
- `node agent-skills/src/verify.js --repo <path>` → for every rule in the repo instance: resolve each evidence anchor (file exists / symbol grep-able / doc path exists); report broken anchors with rule IDs grouped by durability class; exit non-zero on drift. Also validates output artifacts exist, tier-0 stays under a line budget (hard cap, e.g., 20 lines), and trigger words are disjoint across categories.
- `node agent-skills/src/mine.js --repo <path>` → prints/copies a subagent prompt that scans the repo (code + docs) and returns candidate rules in the rule JSON shape as a *diff proposal* for a human to merge into `rules/`. Never writes rules directly.

## Steps

### Phase A — Generic contract + fixture corpus
1. Scaffold `agent-skills/` per layout above: package.json (ESM, scripts `skills:compile`, `skills:check`, `skills:test`), rule schema in `src/lib/rule-schema.js` including `durability: durable|volatile` and `status: active|experimental`.
2. Author the **fixture repo's** rule corpus (`test/fixtures/tiny-repo/` + matching rules dir) — 15–20 small rules exercising every evidence kind, both durability classes, and multi-category triggers. This doubles as the test subject; no jam-build curation happens in this plan.
3. Write fixture `index.json` tier-0 text + trigger table (line-budgeted).

### Phase B — Deterministic tools
4. Implement `lib/emitters/copilot.js` (depends on 1): emits SKILL.md frontmatter (name/description with trigger words), per-category skills, tier-2 ref docs.
   - Parallel with:
5. Implement `lib/emitters/agents-md.js`: AGENTS.md + relative refs.
6. Implement `compile.js` CLI wiring emitters (depends on 4,5); deterministic output.
7. Implement `verify.js`: anchor resolution (file/symbol/grep/doc) + artifact checks + tier-0 line budget + trigger-word disjointness check (depends on 1).

### Phase C — Tests of the tool itself
8. Fixture repo `test/fixtures/tiny-repo/` with a handful of rules exercising every evidence kind; `node:test` suites for compile (snapshot/stable output, idempotency) and verify (good anchors pass; mutated fixture → drift detected per durability class). Run via `node --test`.
9. Wire npm scripts + add AGPL headers per repo convention; run eslint on `agent-skills/` (add to eslint.config.js node globals scope).

### Phase D — Optional LLM mining hybrid
10. Implement `mine.js`: renders a subagent prompt (repo path, rule schema, existing rules to avoid duplicates) → human reviews JSON diff → merges into `rules/` → recompiles.

### Phase E — Behavioral conformance evals (testing adherence to repo techniques)
11. Golden task suite: 4–6 small tasks per major category **defined against the fixture corpus** (e.g., "add a new cached route following this repo's cache strategy", "write a test for X"), each with a checklist of expected rule IDs. When a real corpus instance is added later (e.g., jam-build post-redesign), its golden tasks extend the suite.
12. Eval protocol: run a fresh agent session scoped to ONLY the generated skills (new workspace or skill-only context), give it one golden task, score output against its checklist → conformance %. Record scores in `agent-skills/evals/<date>/`. First runs manual (in this chat via subagent); later scriptable.
13. Negative control: run same tasks with NO skills; delta between scored-baseline and scored-skill is the measured value of the skill set — also detects rules that are wrong/noise (rules that lower conformance get fixed or dropped).

### Future (explicitly out of scope, listed for orientation)
14. jam-build corpus instance: after BFF + schema redesign lands, run `mine.js --repo /Users/agrant/projects/jam-build` to draft the first rule set from the durable practices inventory (SW-first architecture, heartbeat timers, computed CSP/TT, four-tier testing culture), then curate/merge. Volatile rules (auth env duality, IndexedDB shape) are authored post-migration only.

## Relevant files
- `agent-skills/rules/<repo-instance>/` — NEW contract, one dir per reference repo (Phase A ships only the fixture instance)
- `agent-skills/src/{compile,verify,mine}.js`, `src/lib/emitters/*` — NEW (Phases B,D)
- `agent-skills/test/**` — NEW: fixture repo + its rule corpus + node:test suites (Phases A,C)
- `eslint.config.js` — add/adjust scope for `agent-skills/`
- Pattern template from jam-build only: `src/build/jsonld-validate.js` (standalone validator shape); no jam-build content enters the tool

## Verification
1. `npm run skills:test` — node:test suites pass (compile determinism, anchor verify on fixture).
2. `npm run skills:check -- --repo agent-skills/test/fixtures/tiny-repo` — all fixture anchors resolve; exit 0.
3. Mutate a fixture file in `test/fixtures/tiny-repo/` → `skills:check` exits non-zero naming the broken rule ID, reported under the correct durability class (drift detection works).
4. Delete `agent-skills/out/`, rerun compile twice → byte-identical outputs (determinism).
5. Golden-task conformance: ≥1 baseline + ≥1 skill-conditioned run per fixture category; record scores; confirm skill-conditioned score > baseline.
6. Tier-0 budget check: emitted tier-0 SKILL.md ≤ 20 lines (enforced by verify.js).

## Scope boundaries
- Included: fully generic standalone generator, rule contract with durability classes, Copilot + AGENTS.md emitters, drift verifier, mining prompt, fixture corpus + golden-task eval protocol + first manual runs.
- Excluded (future): any jam-build-specific corpus — deferred until the BFF + schema redesign lands (see Future step 14); auto-merge of mined rules; CI integration (a `skills:check` step is trivial to add later); platforms beyond Copilot/AGENTS.md; publishing as an npm package.

## Further considerations
1. Commit `agent-skills/out/` or gitignore it? Recommendation: commit — makes skill changes reviewable in PR diff and lets the drift check run on CI later. (Cheap to flip.)
2. Trigger-word collisions: category trigger lists should be validated to be mutually disjoint (verify.js can assert no word maps to two categories). Recommended: yes, add to verifier.
3. Rule count growth: if a category exceeds ~15 tier-1 rules, split into sub-categories rather than growing the skill — keeps Tier-1 context small. verify.js can warn on per-category rule counts.
4. Mining pass and category discovery: for an unseen repo, should `mine.js` also *suggest category splits* (it currently assumes categories are human-chosen)? Recommendation: yes — include a "suggested_categories" field in the mining output so the first pass proposes a taxonomy before rules are authored.
