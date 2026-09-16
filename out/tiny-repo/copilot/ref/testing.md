# tiny-repo: testing — reference

Tier-2 rules with evidence anchors. Anchors are relative to the reference repo root and are checked by `skills:check`.

## test-golden-files

_(durable, active)_

Snapshot stable response bodies against golden files in test/fixtures/*.golden.json and review golden diffs like any other code change.

Evidence:
- `file`: `test/fixtures/envelope.golden.json`
- `doc`: `docs/testing.md`
