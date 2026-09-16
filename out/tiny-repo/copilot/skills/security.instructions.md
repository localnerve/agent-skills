# tiny-repo: security instructions

Escape untrusted strings with escapeHtml() before placing them in HTML output.

Call setSecurityHeaders(res) before sending any response body; new routes must not strip or override these headers.

Set Content-Type explicitly on every JSON response rather than relying on defaults.
