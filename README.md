# agent-skills

**agent-skills** is a deterministic generator that turns a *curated rule corpus* about
how a reference repository works into tiered, platform-specific instructions for coding
agents (VS Code Copilot skills and generic `AGENTS.md` files) — plus the tooling to keep
those rules honest.

## What it does

Coding agents are generalists. They follow whatever conventions they can infer from the
code in front of them, but they cannot know a repo's *unstated* disciplines: "never add
npm dependencies", "all fetches go through `CacheStore.getOrFetch`", "escape every
untrusted string before it touches HTML". Writing those down as prose that rots is the
common failure mode.

agent-skills inverts the provenance problem:

- **Rules are data, not LLM output.** Each practice is a small JSON entry (`rules/`)
  with an *evidence anchor* pointing at a real file, symbol, or doc in the reference
  repo. The corpus is curated by humans and versioned like code.
- **Compilation is deterministic.** A pure-Node program compiles the corpus into
  tiered artifacts (always-resident tier-0 skill, per-category skills, deep reference
  docs) for each target platform. Same input → byte-identical output, so changes are
  diff-able and snapshot-testable.
- **Drift is measurable.** A verifier re-resolves every evidence anchor against the
  repo on demand. When code evolves and an anchor breaks, you know *which rule* went
  stale — and whether that's an alarm (durable practice) or expected churn (volatile,
  implementation-anchored).
- **LLM mining is a suggestion layer only.** An optional pass renders a prompt for a
  subagent to scan a repo and *propose* new rules as reviewable JSON. It never writes
  the corpus.
- **Adherence is evaluable.** A golden-task conformance suite measures how well an agent
given only the generated skills follows the corpus, against a no-skills baseline —
quantifying the actual value of the skill set.

## Why it exists

1. Agent instructions written as free-form prose are untestable and rot silently.
   Anchored rules make staleness detectable.
2. Different agents (Copilot, Claude Code, anything reading `AGENTS.md`) want different
   artifact shapes. One corpus, many emitters.
3. Skills that aren't measured become cargo cult. The eval protocol produces a number:
   conformance(skills) − conformance(baseline).

## Prerequisites

- **Node.js ≥ 18.3** (developed and tested on Node 24; the fixture repo's test script
  relies on modern `node --test` behavior).
- **npm** for dev dependencies (eslint only — there are *no runtime dependencies*; all
  tools use the Node standard library).
- Nothing else. No network access, no build step, no native modules.

```bash
npm install
```

## Commands (summary)

| Command | What it does | Details |
| --- | --- | --- |
| `npm run skills:compile` | Compile the rule corpus in `rules/` into platform artifacts in `out/`. Deterministic: repeated runs are byte-identical. | [docs/commands/compile.md](docs/commands/compile.md) |
| `npm run skills:check` | Verify every evidence anchor still resolves in the reference repo; check emitted artifacts, tier-0 line budget, and trigger-word disjointness. Exits non-zero on drift. | [docs/commands/check.md](docs/commands/check.md) |
| `npm run skills:mine` | Render the LLM-mining subagent prompt for an instance, or validate a returned proposal document. Never writes rules. | [docs/commands/mine.md](docs/commands/mine.md) |
| `npm run skills:test` | Run the node:test suites (compile determinism, anchor verification, mining). No new deps needed. | [docs/commands/test.md](docs/commands/test.md) |
| `npm run lint` | ESLint over the whole repo (flat config). | [docs/commands/lint.md](docs/commands/lint.md) |

## Goals

- Ship a **fully generic, repo-agnostic tool**: no single repository is baked in. The
  bundled `tiny-repo` fixture corpus is the test subject and the worked example; real
  corpora (e.g. one for jam-build after its BFF + schema redesign) are added as new
  instances under `rules/<name>/`.
- Keep the **tier-0 artifact tiny** (hard budget of 20 lines) so always-resident agent
  context stays cheap.
- Make every claim in a rule **verifiable** against the reference repo, and make drift
  **cheap to check** (seconds, deterministic, CI-ready).

## Documentation

The README is intentionally a summary. Deep technical detail lives in `docs/`:

| Document | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | System overview, data flow, tiered output design — with mermaid diagrams |
| [docs/rule-contract.md](docs/rule-contract.md) | The rule schema, evidence kinds, durability classes, trigger table |
| [docs/commands/compile.md](docs/commands/compile.md) | `skills:compile` in depth — flags, output layout, determinism contract |
| [docs/commands/check.md](docs/commands/check.md) | `skills:check` in depth — anchor resolution, drift classes, exit codes |
| [docs/commands/mine.md](docs/commands/mine.md) | `skills:mine` in depth — prompt rendering, proposal format, validation |
| [docs/commands/test.md](docs/commands/test.md) | `skills:test` in depth — what each suite covers |
| [docs/commands/lint.md](docs/commands/lint.md) | `lint` — ESLint configuration notes |
| [docs/evals.md](docs/evals.md) | The golden-task conformance eval protocol — what generated the evals, prerequisites, scoring |
| [docs/plan/agent-skills-plan.md](docs/plan/agent-skills-plan.md) | The original plan (Phases A–E) |
| [docs/plan/session-resume-packet.md](docs/plan/session-resume-packet.md) | Current status and gotchas for resuming work |

## Repository layout

```
rules/<repo-instance>/        # THE source of truth (curated data)
  index.json                  # repo metadata, tier-0 text, trigger table
  <category>.rules.json       # one file per category
src/
  compile.js                  # rules -> per-platform artifacts (deterministic)
  verify.js                   # anchor-drift verification + artifact self-tests
  mine.js                     # LLM-mining prompt renderer + proposal validator
  lib/rule-schema.js          # rule entry shape + validation
  lib/loaders.js              # corpus/config loading
  lib/emitters/copilot.js     # SKILL.md + .instructions.md emitter
  lib/emitters/agents-md.js   # AGENTS.md + nested refs emitter
test/
  fixtures/tiny-repo/         # miniature reference repo (the test subject)
  compile.test.mjs            # node:test suites
  verify.test.mjs
  mine.test.mjs
evals/
  tasks/<category>/           # golden-task definitions
  <YYYY-MM-DD>/               # scored run records + report.md
out/                          # generated artifacts (committed; diff-able)
```

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
