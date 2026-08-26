/**
 * Health monitor across registered departments / processes.
 */
import type {
  HealthSnapshot,
  HeartbeatSnapshot,
  ProcessRecord,
  RegisteredDepartment,
} from "./types.js";
import type { RuntimeConfiguration } from "./RuntimeConfiguration.js";
import { isHeartbeatFresh } from "./RuntimeHeartbeat.js";

export function monitorRuntimeHealth(input: {
  departments: RegisteredDepartment[];
  processes: ProcessRecord[];
  heartbeat: HeartbeatSnapshot;
  config: RuntimeConfiguration;
}): HealthSnapshot {
  const notes: string[] = [];
  const dependency_failures: string[] = [];
  const byId = new Map(input.processes.map((p) => [p.id, p]));

  const departments = input.departments.map((d) => {
    const proc = byId.get(d.id);
    if (!d.available) {
      dependency_failures.push(`${d.id} module path missing`);
    }
    if (proc?.state === "FAILED") {
      dependency_failures.push(`${d.id} process FAILED: ${proc.last_error ?? "unknown"}`);
    }
    return {
      id: d.id,
      available: d.available,
      process_state: proc?.state ?? ("STOPPED" as const),
      health: proc?.last_health ?? ("unknown" as const),
      restart_count: proc?.restart_count ?? 0,
    };
  });

  const heartbeat_fresh = isHeartbeatFresh(input.heartbeat, input.config);
  if (!heartbeat_fresh) notes.push("Heartbeat stale");

  const failedCount = departments.filter((d) => d.health === "failed" || !d.available).length;
  const overall =
    failedCount === 0 && heartbeat_fresh
      ? "HEALTHY"
      : failedCount > 3
        ? "FAILED"
        : "DEGRADED";

  if (overall === "HEALTHY") notes.push("All registered departments available and running");

  return {
    generated_at: new Date().toISOString(),
    overall,
    departments,
    heartbeat_fresh,
    dependency_failures,
    notes,
  };
}
