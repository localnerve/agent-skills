import { CacheStore } from "../cache.js";
import { toEnvelope } from "../errors.js";

const store = new CacheStore();

async function fetchItems() {
  return [
    { id: 1, name: "alpha" },
    { id: 2, name: "beta" },
  ];
}

export const itemsRoute = {
  path: "/items",
  method: "GET",
  handler(req, res) {
    store
      .getOrFetch("items", fetchItems)
      .then((items) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ items }));
      })
      .catch((err) => {
        const env = toEnvelope(err);
        res.statusCode = env.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(env.body));
      });
  },
};
