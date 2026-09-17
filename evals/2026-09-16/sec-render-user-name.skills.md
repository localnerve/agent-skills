# sec-render-user-name — skills condition

Task: add a GET route rendering a user-supplied name into HTML safely (2 expected rules).

| Rule | Verdict | Justification |
| --- | --- | --- |
| sec-escape-untrusted | ✅ | `?name` query value passed through `escapeHtml()` from `src/security.js` before interpolation; test asserts `<script>` payload renders no raw tags. |
| sec-headers-before-send | ✅ | `setSecurityHeaders(res)` runs in the server dispatch before the handler (CSP, nosniff, Referrer-Policy, X-Frame-Options all present); route only adds explicit Content-Type, never overrides. Header assertions included in new tests. |

**Score: 2/2 (100%)** — npm test green (9/9). Bonus: missing-name case returns the standard error envelope with explicit `application/json`.
