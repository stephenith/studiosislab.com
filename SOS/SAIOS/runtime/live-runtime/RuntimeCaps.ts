/**
 * Runtime caps — no hardcoded limits in callers.
 */
import type { RuntimeCaps } from "./types.js";

export function loadRuntimeCaps(): RuntimeCaps {
  return {
    maximum_runtime_ms: envIntNullable("SOS_AIOS_MAX_RUNTIME_MS", 300_000),
    maximum_cycle_count: envIntNullable("SOS_AIOS_MAX_CYCLES", 1),
    maximum_restart_attempts: envInt("SOS_AIOS_MAX_RESTART_ATTEMPTS", 3),
    maximum_recovery_attempts: envInt("SOS_AIOS_MAX_RECOVERY_ATTEMPTS", 5),
    heartbeat_timeout_ms: envInt("SOS_AIOS_HEARTBEAT_TIMEOUT_MS", 120_000),
    shutdown_timeout_ms: envInt("SOS_AIOS_SHUTDOWN_TIMEOUT_MS", 15_000),
    startup_timeout_ms: envInt("SOS_AIOS_STARTUP_TIMEOUT_MS", 30_000),
  };
}

export function verifyRuntimeCaps(): RuntimeCaps {
  return {
    ...loadRuntimeCaps(),
    maximum_runtime_ms: 60_000,
    maximum_cycle_count: 1,
  };
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
