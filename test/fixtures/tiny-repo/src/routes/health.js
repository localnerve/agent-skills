export const healthRoute = {
  path: "/health",
  method: "GET",
  handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  },
};
