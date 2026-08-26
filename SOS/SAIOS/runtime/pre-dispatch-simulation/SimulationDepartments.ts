/**
 * SimulationDepartments — Agent #187.
 * Allocation metadata only. executing=false.
 */
import type { SimulationDepartmentAllocation } from "./SimulationTypes.js";

export function buildDepartmentAllocations(input?: {
  department_ids?: string[];
}): SimulationDepartmentAllocation[] {
  const ids = input?.department_ids?.length
    ? input.department_ids
    : ["resume"];
  return ids.map((department_id) => ({
    department_id,
    role: department_id === "resume" ? "production" : "support",
    allocated: true as const,
    executing: false as const,
  }));
}

export function assertDepartmentIntegrity(
  rows: SimulationDepartmentAllocation[],
): boolean {
  const ids = new Set(rows.map((r) => r.department_id));
  if (ids.size !== rows.length) return false;
  return rows.every((r) => r.allocated === true && r.executing === false);
}
