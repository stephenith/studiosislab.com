/**
 * Paths for deployment package outputs.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const PACKAGE_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/deployment-package",
);

export function ensurePackageRoot(): string {
  mkdirSync(PACKAGE_ROOT, { recursive: true });
  return PACKAGE_ROOT;
}
