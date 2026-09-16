# agent-skills

A deterministic generator that compiles a **curated rule corpus** into tiered agent
skills for multiple platforms, plus a verifier that checks every rule's evidence anchor
still resolves in the reference repo.

The core design decision: practices are *curated data* (a rule corpus with evidence
anchors into the source repo), not LLM output. A small pure-Node program compiles that
corpus into artifacts; an LLM mining pass is an optional suggestion layer that emits
reviewable diffs — never the source of truth.

## Layout

```
rules/<repo-instance>/        # THE source of truth (curated data)
  index.json                  # repo metadata, tier-0 text, trigger table
  <category>.rules.json       # one file per category
src/
  compile.js                  # rules -> per-platform artifacts (deterministic)
  verify.js                   # anchor-drift verification + artifact self-tests
  lib/rule-schema.js          # rule entry shape + validation
  lib/loaders.js              # corpus/config loading
  lib/emitters/copilot.js     # SKILL.md + .instructions.md emitter
  lib/emitters/agents-md.js   # AGENTS.md + nested refs emitter
test/
  fixtures/tiny-repo/         # miniature reference repo (the test subject)
  compile.test.mjs            # node:test suites
  verify.test.mjs
out/                          # generated artifacts (committed; diff-able)
```

## Rule contract

Each rule:

```jsonc
{
  "id": "arch-fetch-through-cache",
  "tier": 1,                       // 1 = inlined into category skill, 2 = reference doc only
  "category": "architecture",
  "instruction": "Fetch all data via CacheStore.getOrFetch(key, fetcher).",
  "triggers": ["cache"],
  "evidence": [                    // must resolve against the reference repo
    { "kind": "symbol", "ref": "getOrFetch", "file": "src/cache.js" },
    { "kind": "doc", "ref": "docs/architecture.md" }
  ],
  "durability": "durable",         // durable = practice-level; volatile = implementation-anchored
  "status": "active"               // active | experimental
}
```

Evidence kinds: `file` (path exists), `symbol` (identifier in a file, word-boundary),
`grep` (literal substring in a file), `doc` (path exists).

## Tiers

- **Tier 0** — one small always-resident `SKILL.md`: core disciplines + trigger table.
- **Tier 1** — one skill per category with its tier-1 rules inlined.
- **Tier 2** — reference docs with full evidence anchors, loaded only when a task needs depth.

## Commands

```bash
npm install
npm run skills:compile      # render out/ from rules/ (deterministic)
npm run skills:check        # verify all anchors + artifacts; exit non-zero on drift
npm run skills:test         # node:test suites
npm run lint                # eslint
```

Add a new reference repo by creating `rules/<name>/` with an `index.json` and one
`<category>.rules.json` per category, then adding the instance to `config.json`.

## Durability & drift

- **durable** rules survive architecture changes; a broken durable anchor is *an alarm*.
- **volatile** rules are implementation-anchored and expected to churn; a broken volatile
  anchor means "re-mine that category", reported as a warning, not a failure.

`verify.js` reports drift separately per durability class.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
