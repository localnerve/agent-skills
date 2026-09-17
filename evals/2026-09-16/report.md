# Conformance eval — 2026-09-16 (tiny-repo)

First manual run of the Phase E protocol (plan steps 11–13). One task per major
category, each scored under **skills** (generated skills as standing instructions)
and **baseline** (no skills) conditions. Same scorer for both; each run in an
isolated copy of `test/fixtures/tiny-repo`, changes only, `npm test` green.

## Results

| Task (category) | Expected rules | Skills | Baseline | Δ |
| --- | --- | --- | --- | --- |
| arch-add-users-route (architecture) | 3 | 3/3 | 3/3 | 0 |
| test-new-module-tests (testing) | 4 | 4/4 | 4/4 | 0 |
| sec-render-user-name (security) | 2 | 2/2 | 2/2 | 0 |
| **Conformance** | 9 checklist items | **100%** | **100%** | **0** |

Per-task detail: `*.skills.md` / `*.baseline.md` in this directory.

## Interpretation — read before concluding "skills are worthless"

The zero delta is a real result, but it does **not** mean the skill set has no
value. It means this particular corpus + fixture is too easy for a strong generalist
agent to conform to *without* being told the rules:

- The fixture repo is tiny and self-documenting — `items.js` already demonstrates
  the exact cache/envelope/route pattern, so "follow existing conventions" (which the
  task prompts literally ask for) is enough to hit every checklist item.
- Both conditions also independently fixed a **pre-existing bug** in the fixture:
  `package.json`'s test script `node --test test/` fails on Node ≥24 with
  `MODULE_NOT_FOUND`. This is a fixture defect, not an agent failure — see "Follow-ups".

The value of skills shows up where the corpus encodes something **not inferable from
the code**: negative constraints ("never add npm deps", "no routing framework"),
volatiles that are about to change, and cross-cutting invariants. The three chosen
tasks mostly test *positive* patterns already visible in `items.js`.

## Flag rules (rules that could lower conformance)

None observed — no rule produced a skills-condition miss that baseline got right.

## Follow-ups before treating this as a stable measurement

1. **Fix the fixture test script** (`test/fixtures/tiny-repo/package.json`):
   `node --test test/` → a form that works on Node ≥24 (e.g. `node --test`). Both
   agents had to do this; it should not be part of the task.
2. **Add harder tasks** whose conformance depends on a rule *not* visible in the
   existing code — e.g. "add a dependency to speed things up" (expect the agent to
   refuse per the zero-dependency discipline), or a task that tempts an inline script
   under CSP. These are where the skills-vs-baseline delta is expected to be non-zero.
3. **Scale to 4–6 tasks/category** (plan step 11) and re-run; n=3 is directional only.
4. Later: a scoring script so runs are reproducible without manual checklist review.

## Verdict

Protocol works end-to-end (isolation, both conditions, per-rule scoring, honest
delta). Current corpus yields no measurable delta on the easy tasks — expected for a
self-documenting fixture. Next step is harder, rule-dependent golden tasks that can
actually separate the two conditions.
