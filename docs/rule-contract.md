# Rule contract

The rule corpus is the single source of truth in agent-skills. This document defines its
exact shape, what each field means, and the invariants the tooling enforces. Validation
lives in [`src/lib/rule-schema.js`](../src/lib/rule-schema.js); everything below is
enforced mechanically by `skills:check` (via `validateCorpus`) — hand-authoring rules
that break these rules fails verification.

## Corpus layout

One directory per *instance* (a reference repo + its curated practices):

```
rules/<instance-name>/
  index.json                  # instance metadata, tier-0 text, trigger table
  <category>.rules.json       # one file per category; categories are open-ended
```

`tiny-repo` (the fixture) has three categories: `architecture`, `testing`,
`security`. Nothing in the tooling assumes which categories a given instance uses — but
every category *must* be declared in `index.json`.

### index.json

```jsonc
{
  "instance": "tiny-repo",           // MUST equal the directory name
  "description": "...",              // free text, shown in tier-0 artifacts
  "categories": ["architecture", "testing", "security"],
  "tier0": {
    "disciplines": [                 // core non-negotiables; rendered into tier-0 SKILL.md
      "Zero-dependency ESM Node.js; never add npm dependencies.",
      "All data fetching goes through CacheStore.getOrFetch; no ad-hoc caching."
    ],
    "triggers": {                    // trigger table: category -> words that activate it
      "architecture": ["route", "server", "handler", "cache", "error"],
      "testing": ["test", "coverage", "golden", "mock"],
      "security": ["csp", "header", "escape", "xss"]
    }
  }
}
```

Invariants (all checked by `validateCorpus`):

- `instance` must match the directory name.
- `categories` is a non-empty array; every `<category>.rules.json` file's category must
  be declared here, and vice versa for trigger-table keys.
- `tier0.disciplines` is a non-empty array of short imperative statements. Together with
  the trigger table they must fit the **20-line tier-0 budget** enforced at verify time
  against the *emitted* artifact.
- **Trigger words are disjoint across categories.** A word mapping to two categories is a
  hard failure — ambiguity in routing defeats the tiering design.

## Rule entry shape

Each `<category>.rules.json` is an array of rule objects:

```jsonc
{
  "id": "arch-fetch-through-cache",     // unique across the whole instance; kebab-case,
                                        // conventionally prefixed by its category
  "tier": 1,                            // 1 | 2 (see below)
  "category": "architecture",           // MUST equal the file's category
  "instruction": "Fetch all data via CacheStore.getOrFetch(key, fetcher); no ad-hoc caching.",
                                        // agent-facing imperative sentence(s). No repo-specific narration.
  "triggers": ["cache"],                // words/phrases that should surface this rule;
                                        // keep disjoint from other categories where possible
  "evidence": [                         // non-empty; must resolve against the reference repo
    { "kind": "symbol", "ref": "getOrFetch", "file": "src/cache.js" },
    { "kind": "doc", "ref": "docs/architecture.md" }
  ],
  "durability": "durable",              // durable | volatile (see below)
  "status": "active"                    // active | experimental
}
```

Field notes:

- **`id`** — globally unique within the instance. Duplicates are a hard failure. The
  `arch-`/`test-`/`sec-` prefix convention keeps IDs self-describing and makes mining
  proposals' `diff_target: "update:<id>"` unambiguous.
- **`tier`** — controls where the rule appears in generated artifacts:
  - `1`: instruction is inlined into the category skill body (`skills/<category>.SKILL.md`).
    Keep these short; they are loaded on trigger matches, so every one costs context.
  - `2`: only the full entry (instruction + evidence) goes to the reference doc
    (`ref/<category>.md`); the category skill carries a pointer instead. Use for rules
    that need depth but rarely fire.
- **`instruction`** — written for the *agent*, not for humans reading a changelog.
  Imperative, self-contained, no "this repo" narration beyond what's needed to be
  actionable.
- **`triggers`** — lowercase words/phrases. The index-level trigger table routes whole
  categories; rule-level triggers refine within the category and appear in skill
  frontmatter/descriptions.
- **`platforms`** — optional object for per-platform overrides. Reserved for future use;
  emitters currently ignore it.

## Evidence kinds

Evidence anchors are what make a rule *verifiable*: each must resolve against the
reference repo, and `skills:check` re-resolves all of them on every run.

| `kind` | Fields | Resolution (in `verify.js`) | Use for |
| --- | --- | --- | --- |
| `file` | `ref` | `ref` exists as a path in the repo | "this module exists" claims |
| `symbol` | `ref`, `file` | `ref` appears as an identifier (word-boundary regex) in `file` | API/function/class names |
| `grep` | `ref`, `file` | `ref` appears literally (substring) in `file` | exact strings: config values, header names, literals |
| `doc` | `ref` | `ref` exists as a path in the repo | documentation pointers |

Practical notes learned from the fixture corpus:

- **grep anchors are literal.** If the rule says the code calls
  `getOrFetch("items", …)` with double quotes, the grep ref must use double quotes — a
  quote-style mismatch breaks the anchor *silently* until `skills:check` runs.
- **symbol anchors ignore case-sensitivity of surrounding text** but require word
  boundaries: a symbol `cache` will *not* match `caching`.
- Every anchor should point at something the curator actually observed while writing the
  rule. The mining prompt enforces the same discipline on LLM proposals ("never invent
  paths or symbols").

## Durability classes

Every rule declares how much it's expected to survive:

| `durability` | Meaning | What a broken anchor means | verify.js behavior |
| --- | --- | --- | --- |
| `durable` | Practice-level; survives refactors and architecture changes (e.g. "all fetches go through the cache layer") | **An alarm** — either the practice was abandoned or the rule is wrong | Failure → non-zero exit |
| `volatile` | Implementation-anchored; expected to churn with the code (e.g. "the error envelope shape is `{error:{code,message}}` in `src/http.js`") | **"Re-mine that category"** — the implementation moved, re-author the rule against the new code | Warning → exit stays 0 |

This split is what makes drift reporting *actionable* rather than noisy: a real
repository will always have volatile anchors breaking during refactors; treating every
break as an alarm would train people to ignore the check.

## Status

- `active` — the rule is enforced guidance; compiled into skills normally.
- `experimental` — under trial; still compiled, but flagged in artifacts so agents (and
  reviewers) know the practice isn't settled. Use for newly mined rules before they've
  weathered one refactor cycle.

## What the compiler does with all this

(See [commands/compile.md](commands/compile.md) for the full output layout.)

- `index.json` tier-0 text → the always-resident skill; trigger table drives routing.
- Tier-1 rules → inlined into category skill bodies, sorted by `id`.
- Tier-2 rules → reference docs with full evidence rendered (file + symbol/doc refs), so
  an agent can spot-check a claim against the repo.

## Authoring checklist (for humans adding rules)

1. Pick the right category (or add a new one to `index.json` + create its file).
2. Write the instruction as an imperative an agent can act on without reading your mind.
3. Choose the tier by "how often does this need to be in context?" — default to 2 when
   unsure; promote to 1 only for frequently-relevant rules.
4. Anchor it: at least one evidence entry, preferring `symbol`/`grep` over bare `file`
   (path existence is weak evidence).
5. Classify durability honestly — when in doubt between the two, ask "would a rename of
   this file break the rule's *point*?" If yes → volatile; if no → durable.
6. Run `npm run skills:check`, then `npm run skills:compile` and eyeball the diff in
   `out/`.
