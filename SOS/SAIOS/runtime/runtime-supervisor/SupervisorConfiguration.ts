/**
 * Supervisor configuration — no hardcoded operational limits in callers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SupervisorConfiguration } from "./types.js";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const SUPERVISOR_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/runtime-supervisor",
);

export function defaultSupervisorConfiguration(): SupervisorConfiguration {
  return {
    version: "1.0.0",
    dry_run: envBool("SOS_SUPERVISOR_DRY_RUN", true),
    max_cycles: envIntNullable("SOS_SUPERVISOR_MAX_CYCLES", null),
    max_runtime_ms: envIntNullable("SOS_SUPERVISOR_MAX_RUNTIME_MS", null),
    heartbeat_timeout_ms: envInt("SOS_SUPERVISOR_HEARTBEAT_TIMEOUT_MS", 120_000),
    cycle_age_timeout_ms: envInt("SOS_SUPERVISOR_CYCLE_AGE_TIMEOUT_MS", 180_000),
    restart_cooldown_ms: envInt("SOS_SUPERVISOR_RESTART_COOLDOWN_MS", 30_000),
    max_restart_attempts: envInt("SOS_SUPERVISOR_MAX_RESTART_ATTEMPTS", 3),
    max_recovery_attempts: envInt("SOS_SUPERVISOR_MAX_RECOVERY_ATTEMPTS", 5),
    startup_timeout_ms: envInt("SOS_SUPERVISOR_STARTUP_TIMEOUT_MS", 30_000),
    shutdown_timeout_ms: envInt("SOS_SUPERVISOR_SHUTDOWN_TIMEOUT_MS", 15_000),
    morning_digest_max_age_ms: envInt(
      "SOS_SUPERVISOR_MORNING_DIGEST_MAX_AGE_MS",
      36 * 3600_000,
    ),
    evening_digest_max_age_ms: envInt(
      "SOS_SUPERVISOR_EVENING_DIGEST_MAX_AGE_MS",
      36 * 3600_000,
    ),
    fcc_freshness_ms: envInt("SOS_SUPERVISOR_FCC_FRESHNESS_MS", 48 * 3600_000),
    notification_freshness_ms: envInt(
      "SOS_SUPERVISOR_NOTIFICATION_FRESHNESS_MS",
      48 * 3600_000,
    ),
    website_freshness_ms: envInt(
      "SOS_SUPERVISOR_WEBSITE_FRESHNESS_MS",
      48 * 3600_000,
    ),
  };
}

export function verifySupervisorConfiguration(): SupervisorConfiguration {
  return {
    ...defaultSupervisorConfiguration(),
    dry_run: true,
    max_cycles: 1,
    max_runtime_ms: 60_000,
    heartbeat_timeout_ms: 365 * 24 * 3600_000, // verify: don't treat historical heartbeats as fatal
    cycle_age_timeout_ms: 365 * 24 * 3600_000,
  };
}

export function persistSupervisorConfiguration(
  config: SupervisorConfiguration,
): SupervisorConfiguration {
  mkdirSync(SUPERVISOR_ROOT, { recursive: true });
  writeFileSync(
    join(SUPERVISOR_ROOT, "supervisor-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function envIntNullable(name: string, fallback: number | null): number | null {
  const v = process.env[name]?.trim();
  if (v === undefined || v === "") return fallback;
  if (v === "null" || v === "none") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "yes";
}
