# test-new-module-tests — skills condition

Task: add a small pure src module with its test suite (4 expected rules).

| Rule | Verdict | Justification |
| --- | --- | --- |
| test-colocated-node-test | ✅ | New `src/pricing.js` paired with `test/pricing.test.js`, matching the `<module>.test.js` convention. |
| test-assert-observable | ✅ | Asserts return values (`assert.equal`/`strictEqual`) and thrown error types (`assert.throws(..., RangeError)`); no internal-state assertions. No envelope shape existed to deep-compare in this pure module. |
| test-no-network-mocks | ✅ | Pure function; no network/filesystem mocks introduced. |
| test-runner | ✅ | Runs under existing `npm test` (node --test); no new runner or dependency. |

**Score: 4/4 (100%)** — npm test green (10/10).
