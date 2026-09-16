# tiny-repo: security — reference

Tier-2 rules with evidence anchors. Anchors are relative to the reference repo root and are checked by `skills:check`.

## sec-csp-policy

_(durable, active)_

Keep the strict CSP default-src 'none'; any relaxation requires updating docs/architecture.md and a security review.

Evidence:
- `grep`: `src/security.js :: default-src 'none'`
- `doc`: `docs/architecture.md`

## sec-frame-options

_(volatile, active)_

X-Frame-Options DENY is currently set unconditionally; revisit it if the app ever needs to be embedded in a frame.

Evidence:
- `grep`: `src/security.js :: X-Frame-Options`

## sec-referrer-policy

_(volatile, active)_

Referrer-Policy no-referrer applies to all routes; extend per-route policies only with a documented reason.

Evidence:
- `grep`: `src/security.js :: no-referrer`
