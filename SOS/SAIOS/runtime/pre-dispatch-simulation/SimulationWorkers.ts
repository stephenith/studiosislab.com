/**
 * SimulationWorkers — Agent #187.
 * Allocation metadata only. spawned=running=completed=false.
 */
import type { SimulationWorkerAllocation } from "./SimulationTypes.js";

export function buildWorkerAllocations(input?: {
  worker_runtime_ids?: string[];
  department_id?: string;
}): SimulationWorkerAllocation[] {
  const dept = input?.department_id ?? "resume";
  const ids = input?.worker_runtime_ids?.length
    ? input.worker_runtime_ids
    : ["worker-runtime-ref"];
  return ids.map((worker_runtime_id, i) => ({
    worker_id: `sim-worker-${i + 1}`,
    worker_runtime_id,
    department_id: dept,
    capability: i === 0 ? "render" : "critique",
    assigned: true as const,
    spawned: false as const,
    running: false as const,
    completed: false as const,
  }));
}

export function assertWorkerIntegrity(
  rows: SimulationWorkerAllocation[],
): boolean {
  const ids = new Set(rows.map((r) => r.worker_id));
  if (ids.size !== rows.length) return false;
  return rows.every(
    (r) =>
      r.assigned === true &&
      r.spawned === false &&
      r.running === false &&
      r.completed === false,
  );
}
