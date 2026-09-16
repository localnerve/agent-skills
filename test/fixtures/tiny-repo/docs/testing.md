# Testing

tiny-repo has a small but strict testing culture.

## Conventions

- Every module under `src/` has a colocated `node:test` file in `test/` named
  `<module>.test.js`. Run them with `npm test` (which runs `node --test`).
- Tests assert observable behavior — return values, status codes, response bodies —
  not internal state. Use `assert.deepStrictEqual` for envelope shapes.
- Do not mock the network or the filesystem. Where a seam is needed, inject a fake
  fetcher into `CacheStore.getOrFetch`; that is the only sanctioned test double.

## Golden files

Stable response bodies are snapshot-tested against golden files in
`test/fixtures/*.golden.json`. Update a golden file only when the change is intentional,
and review the diff like any other code change.

## Coverage

Coverage threshold is 80% lines. It will be revisited after the planned BFF refactor;
treat it as a floor, not a target.
