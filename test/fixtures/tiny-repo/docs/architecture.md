# Architecture

tiny-repo is a zero-dependency ESM Node.js app: an HTTP server, a small route table,
a TTL cache, and strict security headers.

## Route registration

Every HTTP route is a plain object `{ path, method, handler }` exported from a file in
`src/routes/`. The full route list lives in `registerRoutes` in `src/server.js`.
Do not introduce a routing framework; add a new file to `src/routes/` and register it.

## Cache strategy

All data fetching goes through `CacheStore.getOrFetch(key, fetcher)` in `src/cache.js`.
The store implements stale-while-revalidate: an entry younger than `ttlMs` is served
fresh; an entry older than `ttlMs` but younger than `staleMs` is served immediately
while a background revalidation refreshes it; beyond `staleMs` the next caller blocks
on a fresh fetch. Do not add a second caching layer or per-call ad-hoc memoization.

## Error envelope

Errors leave the process only as the `{ error: { code, message } }` envelope produced by
`toEnvelope` in `src/errors.js`. Never send raw stack traces or exception objects to
clients.
