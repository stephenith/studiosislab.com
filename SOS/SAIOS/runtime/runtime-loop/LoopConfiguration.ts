/**
 * Runtime Loop configuration — no hardcoded operational intervals in callers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LoopConfiguration } from "./types.js";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const RUNTIME_LOOP_ROOT = join(REPO_ROOT, "SOS/07_LOGS/saios/runtime-loop");

export function defaultLoopConfiguration(): LoopConfiguration {
  return {
    version: "1.0.0",
    runtime_interval_ms: envInt("SOS_RUNTIME_LOOP_INTERVAL_MS", 60_000),
    heartbeat_interval_ms: envInt("SOS_RUNTIME_HEARTBEAT_INTERVAL_MS", 30_000),
    dashboard_interval_ms: envInt("SOS_RUNTIME_DASHBOARD_INTERVAL_MS", 120_000),
    health_interval_ms: envInt("SOS_RUNTIME_HEALTH_INTERVAL_MS", 60_000),
    scheduler_interval_ms: envInt("SOS_RUNTIME_SCHEDULER_INTERVAL_MS", 60_000),
    notification_interval_ms: envInt("SOS_RUNTIME_NOTIFICATION_INTERVAL_MS", 120_000),
    dry_run: envBool("SOS_RUNTIME_LOOP_DRY_RUN", true),
    max_cycles: envIntNullable("SOS_RUNTIME_LOOP_MAX_CYCLES", null),
    max_runtime_ms: envIntNullable("SOS_RUNTIME_LOOP_MAX_RUNTIME_MS", null),
    startup_timeout_ms: envInt("SOS_RUNTIME_LOOP_STARTUP_TIMEOUT_MS", 30_000),
    shutdown_timeout_ms: envInt("SOS_RUNTIME_LOOP_SHUTDOWN_TIMEOUT_MS", 15_000),
    sleep_ms_override: envIntNullable("SOS_RUNTIME_LOOP_SLEEP_MS", null),
  };
}

export function verifyLoopConfiguration(): LoopConfiguration {
  return {
    ...defaultLoopConfiguration(),
    dry_run: true,
    max_cycles: 1,
    max_runtime_ms: 30_000,
    sleep_ms_override: 0,
    runtime_interval_ms: 0,
  };
}

export function persistLoopConfiguration(config: LoopConfiguration): LoopConfiguration {
  mkdirSync(RUNTIME_LOOP_ROOT, { recursive: true });
  writeFileSync(
    join(RUNTIME_LOOP_ROOT, "loop-config.json"),
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
