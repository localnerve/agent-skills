---
name: tiny-repo-architecture
description: Architecture rules for the tiny-repo reference repo. Trigger words: route, server, handler, cache, error.
applyTo: **/*
---

# tiny-repo: architecture

- **arch-error-envelope** — Build error responses only with toEnvelope(); never send raw exceptions or stack traces to clients.
- **arch-fetch-through-cache** — Fetch all data via CacheStore.getOrFetch(key, fetcher); never memoize or cache per call.
- **arch-no-routing-framework** — Do not introduce a routing framework; routes are plain { path, method, handler } objects.
- **arch-route-registration** — Register every HTTP route through registerRoutes() in src/server.js; add one file per route under src/routes/ and append it to the ROUTES list.

Deeper context: read `agent-skills/out/tiny-repo/copilot/ref/architecture.md` when the task needs more than the rules above.
