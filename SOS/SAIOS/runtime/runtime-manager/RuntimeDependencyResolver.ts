/**
 * Resolves department startup order from dependency graph.
 */
import type { DepartmentId, RegisteredDepartment } from "./types.js";

export function buildDependencyEdges(
  departments: RegisteredDepartment[],
): Array<{ from: DepartmentId; to: DepartmentId }> {
  const edges: Array<{ from: DepartmentId; to: DepartmentId }> = [];
  for (const dept of departments) {
    for (const dep of dept.depends_on) {
      edges.push({ from: dep, to: dept.id });
    }
  }
  return edges;
}

/**
 * Kahn topological sort. Stable secondary sort by label for determinism.
 */
export function resolveStartupOrder(departments: RegisteredDepartment[]): DepartmentId[] {
  const ids = new Set(departments.map((d) => d.id));
  const indegree = new Map<DepartmentId, number>();
  const children = new Map<DepartmentId, DepartmentId[]>();

  for (const d of departments) {
    indegree.set(d.id, indegree.get(d.id) ?? 0);
    children.set(d.id, children.get(d.id) ?? []);
  }

  for (const d of departments) {
    for (const dep of d.depends_on) {
      if (!ids.has(dep)) continue;
      indegree.set(d.id, (indegree.get(d.id) ?? 0) + 1);
      const list = children.get(dep) ?? [];
      list.push(d.id);
      children.set(dep, list);
    }
  }

  const labelOf = (id: DepartmentId) =>
    departments.find((d) => d.id === id)?.label ?? id;

  const queue = [...indegree.entries()]
    .filter(([, n]) => n === 0)
    .map(([id]) => id)
    .sort((a, b) => labelOf(a).localeCompare(labelOf(b)));

  const order: DepartmentId[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of children.get(id) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) {
        queue.push(child);
        queue.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
      }
    }
  }

  if (order.length !== departments.length) {
    // Cycle fallback: append remaining in catalog order
    for (const d of departments) {
      if (!order.includes(d.id)) order.push(d.id);
    }
  }

  return order;
}

/**
 * Spec example order preferred when resolvable; otherwise topo sort.
 */
export function preferredStartupOrder(departments: RegisteredDepartment[]): DepartmentId[] {
  const preferred: DepartmentId[] = [
    "factory-state",
    "timeline-department",
    "notification-department",
    "website-department",
    "scheduler",
    "resume-factory",
    "production-dashboard",
    "founder-dashboard",
    "release-manager",
    "catalog-integrity",
    "batch-release",
  ];
  const available = new Set(departments.map((d) => d.id));
  const filtered = preferred.filter((id) => available.has(id));
  if (filtered.length === departments.length) return filtered;
  return resolveStartupOrder(departments);
}
