# sec-render-user-name — baseline condition (no skills)

Task: add a GET route rendering a user-supplied name into HTML safely (2 expected rules).

| Rule | Verdict | Justification |
| --- | --- | --- |
| sec-escape-untrusted | ✅ | Reads `?name` via `URL.searchParams`, applies the repo's existing `escapeHtml()` before HTML output; adds a pre-escape length cap. Test covers an XSS payload. |
| sec-headers-before-send | ✅ | Server applies `setSecurityHeaders(res)` before dispatch; route adds explicit Content-Type without touching security headers; tests assert header presence. |

**Score: 2/2 (100%)** — npm test green (9/9).
