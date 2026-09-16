/**
 * Error envelope: the only shape errors may take when they leave the process.
 */
export function toEnvelope(err, { code = "internal", status = 500 } = {}) {
  const body = { error: { code, message: err?.message ?? String(err) } };
  return { status, body };
}
