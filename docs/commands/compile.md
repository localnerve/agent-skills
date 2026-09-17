# `skills:compile` — compile the rule corpus into platform artifacts

```bash
npm run skills:compile            # = node src/compile.js
```

Compiles every configured instance in `rules/` into agent-facing artifacts under its
out dir (default `out/<instance>/`). This is the only command that writes generated
files.

## Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--config <path>` | `<root>/config.json` | Config file with `instances` and `platforms` |
| `--instance <name>` (repeatable) | all instances | Compile only the named instance(s) |
| `--platform copilot,agents-md` | `platforms` from config | Comma-separated subset of platforms to emit |

Example: compile just the fixture for Copilot artifacts only:

```bash
node src/compile.js --instance tiny-repo --platform copilot
```

## Input

- **`config.json`** — maps instance names to their reference repo path and out dir:

  ```jsonc
  {
    "instances": {
      "tiny-repo": { "repoPath": "test/fixtures/tiny-repo", "outDir": "out/tiny-repo" }
    },
    "platforms": ["copilot", "agents-md"]
  }
  ```

- **`rules/<instance>/`** — the corpus: `index.json` + one `<category>.rules.json` per
  category. Shape and invariants: [../rule-contract.md](../rule-contract.md).

Note that compile *loads and shape-validates* the corpus (bad JSON or schema violations
abort with a message), but it does **not** resolve evidence anchors against the repo —
that is `skills:check`'s job. A rule can compile fine while its anchor is already
stale; check is what catches that.

## Output layout

The instance's out dir is **wiped and rewritten** on every run, so deleted categories
never leave stale artifacts behind. For the `tiny-repo` fixture:

```
out/tiny-repo/
  copilot/
    agent-skills.SKILL.md              # tier 0: disciplines + trigger table (≤ 20 lines)
    skills/
      architecture.SKILL.md            # tier 1: inlined tier-1 rules, sorted by id
      architecture.instructions.md     # applyTo-scoped instruction variant
      testing.SKILL.md
      testing.instructions.md
      security.SKILL.md
      security.instructions.md
    ref/
      architecture.md                  # tier 2: full rule entries + evidence anchors
      testing.md
      security.md
  agents-md/
    AGENTS.md                          # tier 0 + trigger table, single file
    docs/agent-rules/
      architecture.md                  # category rules, referenced relatively
      testing.md
      security.md
```

Tier semantics (which rule lands where) are documented in
[../architecture.md#tiered-output-design](../architecture.md).

## Determinism contract

Repeated runs on identical input produce **byte-identical** files:

- categories processed in sorted order; rules within a category sorted by `id`;
- no timestamps, no absolute paths, no environment-dependent values in output;
- the out dir is wiped first, so the *set* of emitted files is deterministic too.

What this buys you:

1. `git diff` on `out/` after editing `rules/` shows exactly what changed in the
   agent-facing instructions — nothing else moves.
2. CI can assert "recompiling is a no-op" as an invariant (compile twice, compare).
3. The test suite (`test/compile.test.mjs`) does byte-comparisons to prove stability
   and idempotency.

## When to run it

- After any edit to `rules/` or `config.json`.
- Before a conformance eval run (the skills under test must match the corpus exactly —
  see [../evals.md](../evals.md)).
- Never by hand on files in `out/`: treat everything there as derived.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | All requested instances compiled |
| 1 | Unexpected I/O or validation error (message on stderr) |
| 2 | Unknown CLI argument, or unknown instance name |
