# tiny-repo: security

- **sec-escape-untrusted** — Escape untrusted strings with escapeHtml() before placing them in HTML output.
- **sec-headers-before-send** — Call setSecurityHeaders(res) before sending any response body; new routes must not strip or override these headers.
- **sec-json-content-type** — Set Content-Type explicitly on every JSON response rather than relying on defaults.

## Reference (with evidence anchors, repo-relative)

### sec-csp-policy _(durable, active)_

Keep the strict CSP default-src 'none'; any relaxation requires updating docs/architecture.md and a security review.

- `grep`: `src/security.js :: default-src 'none'`
- `doc`: `docs/architecture.md`

### sec-frame-options _(volatile, active)_

X-Frame-Options DENY is currently set unconditionally; revisit it if the app ever needs to be embedded in a frame.

- `grep`: `src/security.js :: X-Frame-Options`

### sec-referrer-policy _(volatile, active)_

Referrer-Policy no-referrer applies to all routes; extend per-route policies only with a documented reason.

- `grep`: `src/security.js :: no-referrer`
