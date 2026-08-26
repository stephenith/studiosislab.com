/**
 * Process lifecycle registry helpers.
 */
import type { DepartmentId, ProcessRecord, RegisteredDepartment, RuntimeLifecycleState } from "./types.js";

export function createStoppedProcesses(
  departments: RegisteredDepartment[],
): Map<DepartmentId, ProcessRecord> {
  const map = new Map<DepartmentId, ProcessRecord>();
  for (const d of departments) {
    map.set(d.id, {
      id: d.id,
      state: "STOPPED",
      started_at: null,
      stopped_at: null,
      restart_count: 0,
      last_error: null,
      last_health: d.available ? "unknown" : "failed",
      uptime_ms: 0,
    });
  }
  return map;
}

export function markStarting(proc: ProcessRecord, at: string): ProcessRecord {
  return { ...proc, state: "STARTING", started_at: at, stopped_at: null, last_error: null };
}

export function markRunning(proc: ProcessRecord, at: string): ProcessRecord {
  return {
    ...proc,
    state: "RUNNING",
    started_at: proc.started_at ?? at,
    last_health: "ok",
    last_error: null,
  };
}

export function markFailed(proc: ProcessRecord, error: string): ProcessRecord {
  return { ...proc, state: "FAILED", last_error: error, last_health: "failed" };
}

export function markRecovering(proc: ProcessRecord): ProcessRecord {
  return {
    ...proc,
    state: "RECOVERING",
    restart_count: proc.restart_count + 1,
  };
}

export function markStopped(proc: ProcessRecord, at: string): ProcessRecord {
  const uptime =
    proc.started_at != null ? Math.max(0, Date.parse(at) - Date.parse(proc.started_at)) : 0;
  return {
    ...proc,
    state: "STOPPED",
    stopped_at: at,
    uptime_ms: uptime,
  };
}

export function refreshUptime(
  processes: Map<DepartmentId, ProcessRecord>,
  nowIso: string,
): ProcessRecord[] {
  return [...processes.values()].map((p) => {
    if (p.state !== "RUNNING" && p.state !== "RECOVERING" && p.state !== "STARTING") {
      return p;
    }
    const started = p.started_at ? Date.parse(p.started_at) : Date.parse(nowIso);
    return { ...p, uptime_ms: Math.max(0, Date.parse(nowIso) - started) };
  });
}

export function setState(
  map: Map<DepartmentId, ProcessRecord>,
  id: DepartmentId,
  state: RuntimeLifecycleState,
): void {
  const current = map.get(id);
  if (!current) return;
  map.set(id, { ...current, state });
}
