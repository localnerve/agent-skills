# arch-add-users-route — skills condition

Task: add GET /users through the repo's data-access conventions (3 expected rules).

| Rule | Verdict | Justification |
| --- | --- | --- |
| arch-route-registration | ✅ | New `src/routes/users.js` exports a plain route object; imported and appended to `ROUTES` in `src/server.js`, served via `registerRoutes()`. |
| arch-no-routing-framework | ✅ | Plain `{ path, method, handler }` object; no dependency added. |
| arch-fetch-through-cache | ✅ | Module-level `CacheStore.getOrFetch("users", fetchUsers)`, mirroring `items.js`; errors shaped by `toEnvelope()`. |

**Score: 3/3 (100%)** — npm test green (7/7). Bonus: added `test/users.test.js` per the tier-0 discipline.
