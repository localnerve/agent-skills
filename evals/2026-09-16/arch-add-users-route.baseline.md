# arch-add-users-route — baseline condition (no skills)

Task: add GET /users through the repo's data-access conventions (3 expected rules).

| Rule | Verdict | Justification |
| --- | --- | --- |
| arch-route-registration | ✅ | `src/routes/users.js` created and appended to `ROUTES` in `src/server.js`. |
| arch-no-routing-framework | ✅ | Plain route object; no framework or dependency introduced. |
| arch-fetch-through-cache | ✅ | `CacheStore.getOrFetch("users", fetchUsers)` with failures mapped via `toEnvelope()`. |

**Score: 3/3 (100%)** — npm test green (5/5). Note: baseline agent independently fixed the fixture's Node-24-incompatible `npm test` script (`node --test test/` → `node --test`).
