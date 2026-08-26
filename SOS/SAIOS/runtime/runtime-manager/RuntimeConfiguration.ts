/**
 * Runtime configuration and paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const RUNTIME_MANAGER_ROOT = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-manager");

export type RuntimeConfiguration = {
  version: string;
  heartbeat_interval_ms: number;
  max_restarts_per_department: number;
  timezone: string;
  environment: "development" | "staging" | "production";
};

export function defaultRuntimeConfiguration(): RuntimeConfiguration {
  return {
    version: "1.0.0",
    heartbeat_interval_ms: 60_000,
    max_restarts_per_department: 3,
    timezone: "Asia/Kolkata",
    environment: "development",
  };
}

export function persistRuntimeConfiguration(
  config = defaultRuntimeConfiguration(),
): RuntimeConfiguration {
  mkdirSync(RUNTIME_MANAGER_ROOT, { recursive: true });
  writeFileSync(
    join(RUNTIME_MANAGER_ROOT, "runtime-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}
