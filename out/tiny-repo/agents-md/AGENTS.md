# Agent rules: tiny-repo

## Core disciplines

- Zero-dependency ESM Node.js; never add npm dependencies.
- Call setSecurityHeaders() before every send; escape untrusted strings with escapeHtml().
- All data fetching goes through CacheStore.getOrFetch; no ad-hoc caching.
- Errors leave only as the { error: { code, message } } envelope; every src/ module has a node:test file — run `npm test`.

## Category rules

- **architecture** (route, server, handler, cache, error) — see [docs/agent-rules/architecture.md](docs/agent-rules/architecture.md)
- **security** (csp, header, escape, xss) — see [docs/agent-rules/security.md](docs/agent-rules/security.md)
- **testing** (test, coverage, golden, mock) — see [docs/agent-rules/testing.md](docs/agent-rules/testing.md)
