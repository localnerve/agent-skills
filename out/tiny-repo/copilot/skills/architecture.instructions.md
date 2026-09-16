# tiny-repo: architecture instructions

Build error responses only with toEnvelope(); never send raw exceptions or stack traces to clients.

Fetch all data via CacheStore.getOrFetch(key, fetcher); never memoize or cache per call.

Do not introduce a routing framework; routes are plain { path, method, handler } objects.

Register every HTTP route through registerRoutes() in src/server.js; add one file per route under src/routes/ and append it to the ROUTES list.
