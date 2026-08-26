/**
 * Security department configuration and paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const SECURITY_DEPARTMENT_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/security-department",
);

export type SecurityConfiguration = {
  version: string;
  heartbeat_stale_ms: number;
  disk_warn_pct: number;
  disk_critical_pct: number;
  min_node_major: number;
};

export function defaultSecurityConfiguration(): SecurityConfiguration {
  return {
    version: "1.0.0",
    heartbeat_stale_ms: 120_000,
    disk_warn_pct: 80,
    disk_critical_pct: 90,
    min_node_major: 20,
  };
}

export function persistSecurityConfiguration(
  config = defaultSecurityConfiguration(),
): SecurityConfiguration {
  mkdirSync(SECURITY_DEPARTMENT_ROOT, { recursive: true });
  writeFileSync(
    join(SECURITY_DEPARTMENT_ROOT, "security-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}
