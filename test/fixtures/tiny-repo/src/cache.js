// TTL cache with stale-while-revalidate. The only sanctioned caching layer.

export class CacheStore {
  constructor({ ttlMs = 30_000, staleMs = 60_000 } = {}) {
    this.ttlMs = ttlMs;
    this.staleMs = staleMs;
    this.map = new Map();
  }

  /**
   * Return the cached value for `key`, or fetch it. Stale entries are served
   * immediately while a background revalidation refreshes them.
   */
  async getOrFetch(key, fetcher) {
    const hit = this.map.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    if (hit) {
      void fetcher()
        .then((value) => this.map.set(key, { value, at: Date.now() }))
        .catch(() => {});
      return hit.value;
    }
    const value = await fetcher();
    this.map.set(key, { value, at: Date.now() });
    return value;
  }
}
