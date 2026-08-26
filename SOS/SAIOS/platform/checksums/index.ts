/**
 * Checksum + forbidden-payload primitives — Agent #173.
 */
import { createHash } from "node:crypto";

export type PlatformValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

/** Stable SHA-256 over JSON with sorted top-level keys. */
export function sha256Canonical(value: unknown): string {
  const canonical =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? JSON.stringify(value, Object.keys(value as object).sort())
      : JSON.stringify(value);
  return createHash("sha256").update(canonical).digest("hex");
}

/** SHA-256 of an explicit canonical string (caller owns serialization). */
export function sha256String(canonical: string): string {
  return createHash("sha256").update(canonical).digest("hex");
}

export function rejectForbiddenKeys(
  payload: Record<string, unknown>,
  forbiddenKeys: readonly string[],
  opts?: {
    code?: string;
    messagePrefix?: string;
    messageForKey?: (key: string) => string;
  },
): PlatformValidationIssue | null {
  for (const key of forbiddenKeys) {
    if (key in payload && payload[key] !== undefined) {
      return {
        code: opts?.code ?? "FORBIDDEN_SIDE_EFFECT",
        message:
          opts?.messageForKey?.(key) ??
          (opts?.messagePrefix != null
            ? `${opts.messagePrefix}: '${key}'`
            : `Field '${key}' is forbidden`),
        field: key,
      };
    }
  }
  return null;
}

export function requireExactChecksum(
  actual: string,
  expected: string,
  field = "checksum",
  code = "CHECKSUM_MISMATCH",
): PlatformValidationIssue | null {
  if (actual !== expected) {
    return {
      code,
      message: `${field} mismatch`,
      field,
    };
  }
  return null;
}
