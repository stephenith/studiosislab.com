/**
 * Supervisor heartbeat monitor — reads Runtime Loop / Runtime Manager heartbeats.
 */
import { isoAgeMs, readJsonSafe } from "./supervisor-utils.js";
import type { HeartbeatStatus, SupervisorConfiguration } from "./types.js";

export function readSupervisorHeartbeat(
  config: SupervisorConfiguration,
): HeartbeatStatus {
  const at = new Date().toISOString();
  const loopHb = readJsonSafe<{
    heartbeat_at?: string;
    generated_at?: string;
  }>("SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json");
  const rmHb = readJsonSafe<{
    generated_at?: string;
  }>("SOS/07_LOGS/saios/runtime-manager/runtime-heartbeat.json");

  const heartbeat_at =
    loopHb.data?.heartbeat_at ??
    loopHb.data?.generated_at ??
    rmHb.data?.generated_at ??
    null;
  const age_ms = isoAgeMs(heartbeat_at);
  const stale =
    age_ms == null ? true : age_ms > config.heartbeat_timeout_ms;

  return {
    at,
    heartbeat_at,
    age_ms,
    stale,
    source: loopHb.ok
      ? "runtime-loop/runtime-heartbeat.json"
      : rmHb.ok
        ? "runtime-manager/runtime-heartbeat.json"
        : "missing",
  };
}
