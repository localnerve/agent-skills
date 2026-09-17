# `skills:test` — the tool's own test suites

```bash
npm run skills:test
# = node --test --test-concurrency=1 \
#     test/compile.test.mjs test/verify.test.mjs test/mine.test.mjs
```

Runs the repository's `node:test` suites. Zero extra dependencies: `node --test` is part
of Node itself (≥ 18.3; developed on Node 24). Suites run with `--test-concurrency=1`
because they share filesystem temp dirs and some helpers wipe output roots — serial
execution keeps them deterministic.

## What each suite covers

### `test/compile.test.mjs`

- **Determinism**: compiling the same instance twice yields byte-identical artifacts
  (this is the project's core contract — see [compile.md](compile.md)).
- **Idempotency / wipe behavior**: re-compiling into an out dir that contains stale
  files removes them (the instance out root is wiped before writing).
- **Emitter output shape**: tier-0 contains the disciplines + trigger table; category
  skills inline exactly their tier-1 rules sorted by `id`; ref docs carry the full
  entries with evidence; AGENTS.md references category docs relatively.

### `test/verify.test.mjs`

- **Good anchors pass**: every anchor kind (`file`, `symbol`, `grep`, `doc`) resolves
  against the untouched fixture repo → exit-equivalent success, no failures.
- **Drift detection per durability class**: mutating the fixture (deleting a file,
  renaming a symbol) makes the corresponding rule's anchor break — and it is reported
  under the *correct* class: durable breaks are failures, volatile breaks are warnings.
- **Artifact + budget checks**: missing emitted files fail; a tier-0 artifact over the
  20-line budget fails; trigger-word collisions across categories fail.

### `test/mine.test.mjs`

- **Prompt rendering**: deterministic output; contains the schema contract verbatim;
  injects existing rule ids/instructions for dedup; requires `suggested_categories` in
  the output shape.
- **`validateMiningDoc`**: a well-formed proposal passes; malformed rules are flagged
  with actionable messages (bad evidence kind, bad enum values); duplicate proposed IDs
  are caught; missing `rationale` or a bad/unknown `diff_target` is flagged.

## Fixture corpus: the test subject

Tests don't use synthetic JSON blobs — they drive the real tools against the real
fixture instance: `rules/tiny-repo/` (18 rules across architecture/testing/security)
anchored into `test/fixtures/tiny-repo/`, a miniature but *runnable* zero-dependency ESM
Node app (server + SWR-style cache + security headers + error envelope) with its own
passing test suite. That fixture doubles as:

- the anchor/compiler **test subject** for this repo's tools, and
- the **eval target** for the golden-task conformance suite ([../evals.md](../evals.md)).

## Gotchas baked into the tests (learned the hard way)

- `assert.equal` on two Buffers compares **by reference**, not content — byte comparisons
  use `assert.deepEqual` / `Buffer.isEqual`.
- `node --test` runs test files in parallel by default; since `compileInstance` wipes
  its out root, every suite compiles into its own `.tmp-*` dir (gitignored via the
  `.tmp-*/` pattern), never into the committed `out/`.
- Fixture evidence anchors must match file contents *literally* — e.g. a grep anchor on
  `getOrFetch("items"` includes the double quotes; a quote-style mismatch breaks the
  anchor silently.

## When to run it

- After any change under `src/`, `test/`, or `rules/tiny-repo/`.
- It is fast (seconds) and has no external prerequisites — it's the first thing to run
  when anything in this repo feels wrong.
