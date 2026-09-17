# `lint` — ESLint over the repository

```bash
npm run lint            # = eslint .
```

Runs ESLint (v9, flat config) across the whole repo: `src/`, `test/`, and the config
files themselves. Lint is part of the quality bar alongside `skills:test` — commits are
expected to be lint-clean.

## Configuration notes

- **Flat config** (`eslint.config.js` at the repo root), no `.eslintrc`.
- Base rules come from `@eslint/js`'s recommended set. A version gotcha worth knowing:
  recent `@eslint/js` releases (v9.3x+) expose presets as `js.configs.recommended`, **not**
  the older `js.recommended` shape — if you copy this config elsewhere, check the
  installed version.
- Node globals are provided via the `globals` package (`node: process, Buffer, URL, …`)
  so ESM modules and `node:*` imports don't produce undefined-global noise.
- Source files carry `// SPDX-License-Identifier: AGPL-3.0-or-later` headers (repo
  convention); the canonical license text lives in [LICENSE](../../LICENSE) and should be
  fetched from gnu.org rather than hand-typed if ever regenerated.

## Dev dependencies

Lint is the *only* reason this repo has devDependencies:

```jsonc
"devDependencies": {
  "@eslint/js": "^9.30.0",
  "eslint": "^9.30.0",
  "globals": "^16.2.0"
}
```

There are **no runtime dependencies** — every tool in `src/` uses the Node standard
library only. Keep it that way: the project's portability (copy the folder to any
machine with Node ≥ 18.3 and run) depends on it.

## When to run it

- Before committing, or as part of a pre-commit habit: `npm run lint && npm run skills:test`.
- Lint output is per-file/per-line; fixes are usually mechanical (unused imports,
  unused variables — the mine.js implementation initially tripped both).
