// HTTP server: security headers on every response, then the route table.

import { createServer as createHttpServer } from "node:http";
import { setSecurityHeaders } from "./security.js";
import { healthRoute } from "./routes/health.js";
import { itemsRoute } from "./routes/items.js";

export const PORT = 8787;

const ROUTES = [healthRoute, itemsRoute];

/** Route table: path -> route object. Single source of truth for routing. */
export function registerRoutes(routes) {
  return new Map(routes.map((r) => [r.path, r]));
}

export function createServer() {
  const routes = registerRoutes(ROUTES);
  return createHttpServer((req, res) => {
    setSecurityHeaders(res);
    const route = routes.get(req.url.split("?")[0]);
    if (!route) {
      res.statusCode = 404;
      res.end();
      return;
    }
    route.handler(req, res);
  });
}
