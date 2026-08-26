/**
 * Paths for readiness audit outputs.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const READINESS_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/deployment-readiness",
);

export function ensureReadinessRoot(): string {
  mkdirSync(READINESS_ROOT, { recursive: true });
  return READINESS_ROOT;
}
