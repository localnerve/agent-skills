// Security headers and output escaping for tiny-repo.

const CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * Apply the repo's non-negotiable response headers. Must run before any send.
 */
export function setSecurityHeaders(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
}

/**
 * Escape untrusted strings before they are placed into HTML output.
 */
export function escapeHtml(s) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s).replace(/[&<>"']/g, (c) => map[c]);
}
