---
name: tiny-repo-core
description: Core disciplines and trigger table for the tiny-repo reference repo. Load category skills when task words match the trigger table.
applyTo: **/*
---

# tiny-repo: core disciplines

- Zero-dependency ESM Node.js; never add npm dependencies.
- Call setSecurityHeaders() before every send; escape untrusted strings with escapeHtml().
- All data fetching goes through CacheStore.getOrFetch; no ad-hoc caching.
- Errors leave only as the { error: { code, message } } envelope; every src/ module has a node:test file — run `npm test`.

## Trigger table

| Task words | Skill |
| --- | --- |
| route, server, handler, cache, error | `/tiny-repo-architecture` |
| csp, header, escape, xss | `/tiny-repo-security` |
| test, coverage, golden, mock | `/tiny-repo-testing` |
