/**
 * Heartbeat generator for Runtime Manager.
 */
import { randomUUID } from "node:crypto";
import type { DepartmentId, HeartbeatSnapshot, ProcessRecord } from "./types.js";
import type { RuntimeConfiguration } from "./RuntimeConfiguration.js";

export function createHeartbeat(input: {
  cycle: number;
  processes: ProcessRecord[];
  config: RuntimeConfiguration;
  startedAt: string;
  now?: Date;
}): HeartbeatSnapshot {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const running = input.processes
    .filter((p) => p.state === "RUNNING" || p.state === "RECOVERING")
    .map((p) => p.id);
  const failed = input.processes.filter((p) => p.state === "FAILED").map((p) => p.id);

  let memory_estimate_mb: number | null = null;
  try {
    memory_estimate_mb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  } catch {
    memory_estimate_mb = null;
  }

  return {
    heartbeat_id: `hb-${randomUUID().slice(0, 8)}`,
    generated_at: nowIso,
    cycle: input.cycle,
    running_services: running as DepartmentId[],
    failed_services: failed as DepartmentId[],
    uptime_ms: Math.max(0, now.getTime() - Date.parse(input.startedAt)),
    memory_estimate_mb,
    last_activity: nowIso,
    next_scheduled_cycle: new Date(
      now.getTime() + input.config.heartbeat_interval_ms,
    ).toISOString(),
  };
}

export function isHeartbeatFresh(
  heartbeat: HeartbeatSnapshot,
  config: RuntimeConfiguration,
  now = new Date(),
): boolean {
  const age = now.getTime() - Date.parse(heartbeat.generated_at);
  return age <= config.heartbeat_interval_ms * 2;
}
