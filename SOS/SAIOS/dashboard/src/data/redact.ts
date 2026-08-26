/**
 * Redact secrets from any artifact blob before dashboard use.
 */
const SECRET_KEY =
  /(token|secret|password|api[_-]?key|private[_-]?key|credential|authorization|firebase|telegram|sk-|bearer)/i;

export function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    if (/sk-[a-zA-Z0-9]{10,}/.test(value)) return "[REDACTED]";
    if (/Bearer\s+\S+/i.test(value)) return "[REDACTED]";
    if (/AIza[0-9A-Za-z\-_]{20,}/.test(value)) return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map((v, i) => redactValue(String(i), v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }
  return value;
}

export function assertNoSecretsInJson(blob: string): string[] {
  const issues: string[] = [];
  if (/sk-[a-zA-Z0-9]{20,}/.test(blob)) issues.push("possible openai-style key");
  if (/AIza[0-9A-Za-z\-_]{20,}/.test(blob)) issues.push("possible google api key");
  if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(blob)) {
    issues.push("private key material");
  }
  if (/TELEGRAM.*[:=].*[0-9]{8,}:[A-Za-z0-9_-]{20,}/i.test(blob)) {
    issues.push("possible telegram token");
  }
  return issues;
}
