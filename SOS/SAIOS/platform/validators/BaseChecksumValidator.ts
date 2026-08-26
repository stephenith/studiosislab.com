/**
 * BaseChecksumValidator — Agent #173.
 */
import {
  rejectForbiddenKeys,
  requireExactChecksum,
  sha256Canonical,
  sha256String,
  type PlatformValidationIssue,
} from "../checksums/index.js";

export class BaseChecksumValidator {
  computeCanonical(value: unknown): string {
    return sha256Canonical(value);
  }

  computeString(canonical: string): string {
    return sha256String(canonical);
  }

  rejectForbidden(
    payload: Record<string, unknown>,
    forbiddenKeys: readonly string[],
    opts?: {
      code?: string;
      messagePrefix?: string;
      messageForKey?: (key: string) => string;
    },
  ): PlatformValidationIssue | null {
    return rejectForbiddenKeys(payload, forbiddenKeys, opts);
  }

  requireMatch(
    actual: string,
    expected: string,
    field?: string,
    code?: string,
  ): PlatformValidationIssue | null {
    return requireExactChecksum(actual, expected, field, code);
  }
}

export {
  rejectForbiddenKeys,
  requireExactChecksum,
  sha256Canonical,
  sha256String,
};
export type { PlatformValidationIssue };
