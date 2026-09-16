---
name: tiny-repo-security
description: Security rules for the tiny-repo reference repo. Trigger words: csp, header, escape, xss.
applyTo: **/*
---

# tiny-repo: security

- **sec-escape-untrusted** — Escape untrusted strings with escapeHtml() before placing them in HTML output.
- **sec-headers-before-send** — Call setSecurityHeaders(res) before sending any response body; new routes must not strip or override these headers.
- **sec-json-content-type** — Set Content-Type explicitly on every JSON response rather than relying on defaults.

Deeper context: read `agent-skills/out/tiny-repo/copilot/ref/security.md` when the task needs more than the rules above.
