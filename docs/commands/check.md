# `skills:check` — verify anchors, artifacts, and budgets

```bash
npm run skills:check            # = node src/verify.js
```

Read-only verification pass. For every rule in the configured instance(s), it re-resolves
each evidence anchor against the reference repo, checks that the emitted artifacts are
present and within budget, and validates the corpus itself (schema + trigger
disjointness). It changes nothing; it reports and sets an exit code. Designed to run on
every push in CI — it takes seconds.

## Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--config <path>` | `<root>/config.json` | Config file with `instances` and `platforms` |
| `--instance <name>` (repeatable) | all instances | Verify only the named instance(s) |
| `--repo <path>` | per-instance `repoPath` from config | Override the reference repo root for *all* named instances in this run (useful for testing against a checkout/PR head) |

## What it checks

### 1. Corpus validation (failures)

Re-runs `validateCorpus` on the live instance at verify time (not cached from load), so
a mutated corpus is judged as it currently is:

- schema violations per rule (`tier`, `category`, `instruction`, `triggers`, `durability`,
  `status`, evidence shape);
- duplicate rule IDs across the instance;
- category files not declared in `index.json` (or mismatched `category` fields);
- **trigger-word disjointness**: a trigger word mapping to two categories is a failure —
  ambiguous routing defeats tiering.

### 2. Anchor resolution → drift, grouped by durability class

Every evidence anchor is resolved against the repo root:

| kind | check |
| --- | --- |
| `file` / `doc` | path exists in the repo |
| `symbol` | `ref` appears as a word-boundary identifier in `file` |
| `grep` | `ref` appears literally (substring) in `file` |

Broken anchors are reported **per rule ID, split by durability**:

- `drift (durable): <rule-id>: <problem>` → **failure** (exit 1). A durable practice
  whose anchor broke is an alarm: the practice was abandoned or the rule is wrong.
- `drift (volatile, re-mine candidate): <rule-id>: <problem>` → **warning** (exit stays
  0). Volatile rules are implementation-anchored and expected to churn; a break means
  "re-author this rule against the new code", not "the world is on fire".

This split keeps the check signal-to-noise high on real repositories: refactors will
always break volatile anchors, and treating every break as an alarm would train people
to ignore the output.

### 3. Artifact checks (failures)

Against `out/` for each configured platform:

- Copilot: `agent-skills.SKILL.md` exists; per-category `skills/<category>.SKILL.md`
  and `ref/<category>.md` exist. Missing → "run skills:compile first".
- **Tier-0 line budget**: the emitted tier-0 SKILL.md must be ≤ `TIER0_LINE_BUDGET`
  (20) lines. The always-resident artifact is a hard cost on every agent session, so the
  cap is enforced mechanically rather than by convention.
- AGENTS.md: `AGENTS.md` + per-category `docs/agent-rules/<category>.md` exist.

### 4. Advisories (warnings)

- A category with more than `CATEGORY_TIER1_WARN_THRESHOLD` (15) tier-1 rules warns to
  split it into sub-categories — keeps tier-1 context small.

## Output & exit codes

```
verify: tiny-repo — repo at test/fixtures/tiny-repo
verify: warning: drift (volatile, re-mine candidate): sec-some-rule: symbol "X" not found in "src/y.js"
verify: FAIL: drift (durable): arch-fetch-through-cache: file anchor "src/cache.js" does not exist in the repo
```

| Code | Meaning |
| --- | --- |
| 0 | No failures. Warnings may be present (they are printed but do not fail the run). |
| 1 | One or more failures (corpus schema, durable drift, missing artifacts, tier-0 budget). |
| 2 | Unknown CLI argument or unknown instance name. |

## Typical usage

```bash
npm run skills:check                      # local, after editing rules/ or the repo
node src/verify.js --repo /path/to/pr     # CI: verify anchors against a PR checkout
```

The classic drift-detection exercise (and what `test/verify.test.mjs` automates): delete
or rename a file in the reference repo → `skills:check` exits non-zero naming the broken
rule ID under the correct durability class.
