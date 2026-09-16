# tiny-repo: architecture — reference

Tier-2 rules with evidence anchors. Anchors are relative to the reference repo root and are checked by `skills:check`.

## arch-items-cache-key

_(volatile, experimental)_

The /items route currently caches its list under the key 'items'; if the endpoint is split per tenant, re-key the cache accordingly.

Evidence:
- `grep`: `src/routes/items.js :: getOrFetch("items"`
- `symbol`: `src/routes/items.js :: fetchItems`

## arch-swr-semantics

_(durable, active)_

Follow the stale-while-revalidate contract of CacheStore: fresh within ttlMs, background revalidation between ttlMs and staleMs, blocking fetch beyond staleMs; do not add a second caching layer.

Evidence:
- `grep`: `src/cache.js :: staleMs`
- `doc`: `docs/architecture.md`
