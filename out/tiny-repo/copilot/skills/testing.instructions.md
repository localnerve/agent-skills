# tiny-repo: testing instructions

Assert observable behavior (return values, status codes, response bodies) and use assert.deepStrictEqual for envelope shapes; never assert internal state.

Give every module under src/ a colocated node:test file in test/ named <module>.test.js; run the suite with `npm test`.

Treat the 80% line coverage threshold as a floor to be revisited after the BFF refactor; do not lower it without stating why in the PR description.

Do not mock the network or filesystem; the only sanctioned test double is a fake fetcher injected into CacheStore.getOrFetch().

Run tests with `npm test` (node --test); never introduce another test runner.
