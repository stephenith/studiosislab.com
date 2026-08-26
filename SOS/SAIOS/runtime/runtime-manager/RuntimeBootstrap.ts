/**
 * Bootstraps Runtime Manager: discover, resolve deps, initialize process table.
 */
import { preferredStartupOrder, buildDependencyEdges } from "./RuntimeDependencyResolver.js";
import { createStoppedProcesses } from "./RuntimeLifecycleManager.js";
import { discoverAndRegisterDepartments } from "./RuntimeProcessRegistry.js";
import type { DepartmentId, ProcessRecord, RegisteredDepartment } from "./types.js";

export type BootstrapResult = {
  departments: RegisteredDepartment[];
  startup_order: DepartmentId[];
  processes: Map<DepartmentId, ProcessRecord>;
  edges: Array<{ from: DepartmentId; to: DepartmentId }>;
};

export function bootstrapRuntime(): BootstrapResult {
  const departments = discoverAndRegisterDepartments();
  const startup_order = preferredStartupOrder(departments);
  const processes = createStoppedProcesses(departments);
  const edges = buildDependencyEdges(departments);
  return { departments, startup_order, processes, edges };
}
