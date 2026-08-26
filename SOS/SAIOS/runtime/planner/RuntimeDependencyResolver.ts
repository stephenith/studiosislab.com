/**
 * RuntimeDependencyResolver — deterministic DAG (Agent #169).
 * Detects cycles, missing deps, duplicates, invalid ordering.
 */
import type { QueueSubmissionPackage } from "../../core/company-brain/queue-submission-types.js";
import type { RuntimeDependencyGraph } from "./runtime-plan-types.js";
import type { RuntimeWorkerResolution } from "./runtime-plan-types.js";

function detectCycles(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(n: string): void {
    if (visiting.has(n)) {
      const idx = stack.indexOf(n);
      cycles.push(idx >= 0 ? [...stack.slice(idx), n] : [n, n]);
      return;
    }
    if (visited.has(n)) return;
    visiting.add(n);
    stack.push(n);
    for (const next of adj.get(n) ?? []) dfs(next);
    stack.pop();
    visiting.delete(n);
    visited.add(n);
  }

  for (const n of nodes) dfs(n);
  return cycles;
}

function findDuplicates(items: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const x of items) {
    if (seen.has(x)) dups.add(x);
    seen.add(x);
  }
  return [...dups];
}

export function resolveRuntimeDependencies(
  submission: QueueSubmissionPackage,
  resolution: RuntimeWorkerResolution,
): RuntimeDependencyGraph {
  const nodes = [
    ...new Set([
      ...resolution.worker_order,
      ...submission.dependency_graph.nodes,
      ...submission.execution_graph.nodes.map((n) => n.id),
    ]),
  ];

  const edges = [
    ...submission.dependency_graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
    })),
    ...submission.execution_graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
    })),
  ];

  // Deterministic worker chain edges
  for (let i = 0; i < resolution.workers.length - 1; i++) {
    edges.push({
      from: resolution.workers[i]!,
      to: resolution.workers[i + 1]!,
      kind: "sequential",
    });
  }
  if (resolution.director[0] && resolution.managers[0]) {
    edges.push({
      from: resolution.director[0],
      to: resolution.managers[0],
      kind: "orchestrates",
    });
  }

  const cycles = detectCycles(
    nodes,
    edges.map((e) => ({ from: e.from, to: e.to })),
  );
  const edgeTargets = new Set(edges.map((e) => e.to));
  const edgeSources = new Set(edges.map((e) => e.from));
  const missing_dependencies = nodes.filter(
    (n) =>
      edgeTargets.has(n) &&
      !edgeSources.has(n) &&
      !resolution.director.includes(n) &&
      !n.startsWith("stage-") &&
      !submission.execution_graph.nodes.some(
        (x) => x.id === n && x.order === 0,
      ),
  );

  const duplicate_workers = findDuplicates([
    ...submission.worker_inventory,
    ...resolution.workers,
  ]).filter((d) =>
    submission.worker_inventory.filter((w) => w === d).length > 1,
  );

  const invalid_ordering: string[] = [];
  const stageOrder = new Map(
    submission.execution_graph.nodes.map((n) => [n.id, n.order]),
  );
  for (const e of submission.execution_graph.edges) {
    const fromOrder = stageOrder.get(e.from);
    const toOrder = stageOrder.get(e.to);
    if (
      fromOrder != null &&
      toOrder != null &&
      fromOrder >= toOrder
    ) {
      invalid_ordering.push(`${e.from}→${e.to} (order ${fromOrder}≥${toOrder})`);
    }
  }

  return {
    nodes,
    edges,
    critical_path:
      submission.dependency_graph.critical_path.length > 0
        ? submission.dependency_graph.critical_path
        : submission.execution_graph.critical_path,
    cycles,
    missing_dependencies,
    duplicate_workers,
    invalid_ordering,
    acyclic: cycles.length === 0,
    note: cycles.length
      ? "Dependency cycles detected — plan blocked"
      : "Deterministic DAG · planning only",
  };
}
