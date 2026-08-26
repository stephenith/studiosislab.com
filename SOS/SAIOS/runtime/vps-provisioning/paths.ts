/**
 * Paths for VPS provisioning outputs.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const PROVISIONING_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/vps-provisioning",
);
export const DEPLOYMENT_PACKAGE_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/deployment-package",
);

export function ensureProvisioningRoot(): string {
  mkdirSync(PROVISIONING_ROOT, { recursive: true });
  return PROVISIONING_ROOT;
}
