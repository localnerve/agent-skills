# tiny-repo: testing

- **test-assert-observable** — Assert observable behavior (return values, status codes, response bodies) and use assert.deepStrictEqual for envelope shapes; never assert internal state.
- **test-colocated-node-test** — Give every module under src/ a colocated node:test file in test/ named <module>.test.js; run the suite with `npm test`.
- **test-coverage-floor** — Treat the 80% line coverage threshold as a floor to be revisited after the BFF refactor; do not lower it without stating why in the PR description.
- **test-no-network-mocks** — Do not mock the network or filesystem; the only sanctioned test double is a fake fetcher injected into CacheStore.getOrFetch().
- **test-runner** — Run tests with `npm test` (node --test); never introduce another test runner.

## Reference (with evidence anchors, repo-relative)

### test-golden-files _(durable, active)_

Snapshot stable response bodies against golden files in test/fixtures/*.golden.json and review golden diffs like any other code change.

- `file`: `test/fixtures/envelope.golden.json`
- `doc`: `docs/testing.md`
