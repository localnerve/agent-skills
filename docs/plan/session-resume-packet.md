# Session Resume Packet — agent-skills

_Last updated: 2026-09-16_
_Seed phrase for resuming this work in a fresh session: **"Resume the agent-skills project from docs/plan/agent-skills-plan.md; Phases A–E are done — next up is harder rule-dependent golden tasks (eval follow-ups in evals/2026-09-16/report.md) and, when jam-build's redesign lands, bootstrapping its corpus via src/mine.js."**_

## Where things stand

Phases A–E of `docs/plan/agent-skills-plan.md` are complete, tested, and committed
(git repo on branch `main`, tree clean). Remaining work is follow-up hardening,
not new phases: harder golden tasks that can actually separate skills from baseline,
scaling to 4–6 tasks/category, an optional scoring script, and the future jam-build
corpus (plan step 14).

### Done (A–C)

- **Scaffold** at workspace root: `package.json` (ESM, pure-node runtime; only devDeps are
  eslint/@eslint/js/globals), `config.json` + `config.example.json`, minimal flat
  `eslint.config.js`, AGPL-3.0 headers on source files, canonical `LICENSE` (fetched from
  gnu.org — do not hand-type license text).
- **Fixture corpus** (`rules/tiny-repo/` + `test/fixtures/tiny-repo/`): 18 rules across
  `architecture`, `testing`, `security`; all four evidence kinds exercised
  (`file`/`symbol`/`grep`/`doc`); both durability classes; disjoint trigger table in
  `index.json`. The fixture repo is a real, runnable miniature ESM app
  (server + SWR cache + security headers + error envelope) with its own passing tests.
- **Tools**: `src/compile.js` (deterministic; wipes+rewrites the instance out dir so stale
  artifacts never linger), `src/verify.js` (anchor resolution, drift grouped by durability
  class — durable = hard failure exit 1, volatile = warning; artifact presence; 20-line
  tier-0 budget via `TIER0_LINE_BUDGET`; trigger disjointness; per-category >15 tier-1 warn),
  emitters in `src/lib/emitters/{copilot,agents-md}.js`, shared validation in
  `src/lib/rule-schema.js`, loaders in `src/lib/loaders.js`.
- **Tests**: `test/compile.test.mjs` + `test/verify.test.mjs`, 14 tests, all green via
  `npm run skills:test` (runs `node --test --test-concurrency=1`).

### User decisions to honor

- Workspace-root layout; git initialized on `main`.
- **`out/` is committed** (reviewable diffs; CI-ready) — flip only if asked.
- Fresh minimal ESLint config was chosen over skipping lint.
- AGPL-3.0 headers + LICENSE file, yes.
- jam-build corpus stays out until its BFF + schema redesign lands (plan step 14).

## Gotchas learned the hard way (read before touching tests)

- `assert.equal` on two Buffers compares **by reference**, not content — always use
  `assert.deepEqual` or `Buffer.isEqual` for byte-comparisons.
- `node --test` runs test files **in parallel**; since `compileInstance` wipes the
  instance out root, every suite compiles into its own `.tmp-*` dir (gitignored via
  `.tmp-*/`), never the committed `out/`.
- `@eslint/js` v9.39 exposes configs as `js.configs.recommended`, **not** `js.recommended`.
- `verify.js` re-runs `validateCorpus` on the live instance at verify time (not the
  load-time `instance.problems`) so tests can mutate an instance and expect fresh
  validation results.
- `compileInstance` returns paths relative to repo root prefixed with the out-dir basename
  (e.g. `.tmp-compile-out/tiny-repo/...`).
- Fixture evidence anchors must match file contents literally — e.g. `getOrFetch("items"`
  (double quotes) in items.js; a quote-style mismatch breaks the grep anchor silently.

## Phase D — LLM mining hybrid (`src/mine.js`) — DONE 2026-09-16

Implemented: `renderMiningPrompt(instance, repoPath)` (deterministic; injects existing
rule ids+instructions for dedup, the schema contract verbatim, requires
`suggested_categories` + `proposed_rules[].rationale` + `diff_target` new|update:<id>)
and `validateMiningDoc(doc, instance)` (per-rule `validateRule` + rationale/diff_target/
category checks + duplicate ids). CLI: `node src/mine.js [--instance <name>]`
prints the prompt; `--validate <proposal.json>` exit 1 on malformed rules.
Tests in `test/mine.test.mjs` (8 tests).

## Phase D (original brief, kept for reference)

Plan step 10: implement `mine.js --repo <path>` which **renders a subagent prompt** that
scans the repo (code + docs) and returns candidate rules in the rule JSON shape as a
*diff proposal* for a human to merge into `rules/`. It must never write rules directly.

Suggested implementation notes:

- Reuse `loadInstance` to inject **existing rules** into the prompt so mining avoids
  duplicates (pass rule IDs + instructions, not full evidence).
- Pass the rule contract from `src/lib/rule-schema.js` verbatim (field list, evidence
  kinds, durability/status enums) so output is machine-checkable.
- Output shape: a JSON document with `suggested_categories` (plan consideration #4 —
  first pass proposes a taxonomy before rules are authored) plus `proposed_rules[]`.
  Each proposed rule should carry the same schema **plus** a `rationale` and a suggested
  diff target (`new` / `update:<rule-id>`).
- Validation hook: run `validateRule` on each proposed rule in-process so obviously
  malformed candidates are flagged before a human ever sees them.
- Prompt should instruct the miner to prefer **durable** practice-level rules and mark
  implementation-specific ones `volatile`; evidence anchors must be real file paths /
  symbols it actually observed (it can run read-only commands).
- Tests: at minimum, render the prompt for the tiny-repo fixture and assert it contains
  existing rule IDs, the schema field list, and the repo path; keep output deterministic.

## Phase E — Behavioral conformance evals (plan steps 11–13) — first run DONE 2026-09-16

Suite defined: `evals/tasks/<category>/*.json` (8 tasks: 3 architecture, 2 testing,
3 security) + `evals/PROTOCOL.md`. First manual run executed per protocol
(3 tasks × skills/baseline in isolated `.tmp-eval/` copies via subagents):
**100% vs 100%, delta 0** — recorded with full interpretation in
`evals/2026-09-16/report.md`. The zero delta is expected for a self-documenting
fixture: the chosen tasks test positive patterns already visible in `items.js`, which
a strong agent follows without being told. Follow-ups (in report): harder
rule-dependent tasks (negative constraints, CSP temptations), 4–6 tasks/category,
optional scoring script.
Also fixed during the run: fixture `package.json` test script `node --test test/`
→ `node --test` (Node ≥24 MODULE_NOT_FOUND; both agents had to do this).

## Phase E (original brief, kept for reference)

Golden-task suite **defined against the fixture corpus** (4–6 tasks per major category),
each with a checklist of expected rule IDs.

Suggested structure:

- `evals/tasks/<category>/<task-id>.json` — task prompt + `expected_rules: [ids]`.
  Candidates from the current corpus, e.g.:
  - architecture: "add a /users route that fetches via the cache layer" → expect
    `arch-route-registration`, `arch-fetch-through-cache`, `arch-no-routing-framework`;
    "handle an upstream failure in a new endpoint" → `arch-error-envelope`.
  - testing: "write tests for a new module" → `test-colocated-node-test`,
    `test-assert-observable`, `test-no-network-mocks`, `test-runner`.
  - security: "render a user-supplied name into the health page" →
    `sec-escape-untrusted`, `sec-headers-before-send`, `sec-json-content-type`.
- **Protocol**: run a fresh agent session scoped to ONLY the generated skills (new
  workspace or skill-only context), give it one golden task, score output against its
  checklist → conformance %. Record scores in `evals/<date>/` (commit them).
- **Negative control** (step 13): same tasks with NO skills; delta = measured value of
  the skill set. Rules that *lower* conformance get fixed or dropped — record this in the
  eval report, not silently.
- Scoring script can come later; first runs are manual (subagent in-chat) per plan.

## Quick commands

```bash
npm run skills:compile   # render out/ from rules/ (deterministic; safe to re-run)
npm run skills:check     # anchor + artifact verification; exit 1 on durable drift
npm run skills:test      # node:test suites (serialized across files)
npm run lint             # eslint
```

Drift-detection sanity check that was used during build: temporarily rename a symbol in
the fixture (e.g. `toEnvelope`), confirm `skills:check` exits 1 naming the rule under the
durable class, then revert.
