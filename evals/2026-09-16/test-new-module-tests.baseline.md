# test-new-module-tests — baseline condition (no skills)

Task: add a small pure src module with its test suite (4 expected rules).

| Rule | Verdict | Justification |
| --- | --- | --- |
| test-colocated-node-test | ✅ | `src/pricing.js` + `test/pricing.test.js`, colocated per existing convention. |
| test-assert-observable | ✅ | `assert.equal` on scalar results and `assert.throws(..., RangeError)` for validation; observable behavior only. |
| test-no-network-mocks | ✅ | Pure module; no mocks of any kind. |
| test-runner | ✅ | Existing `npm test` (node --test) used; no new runner added. |

**Score: 4/4 (100%)** — npm test green (9/9). Baseline agent also fixed the fixture's broken Node-24 test script.
