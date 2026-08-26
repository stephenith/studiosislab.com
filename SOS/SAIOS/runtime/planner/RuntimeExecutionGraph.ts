/**
 * RuntimeExecutionGraph — deterministic stage graph (Agent #169).
 * Informational only. Never invokes workers.
 */
import type {
  RuntimeExecutionGraph,
  RuntimePlanEdge,
  RuntimePlanNode,
} from "./runtime-plan-types.js";
import type { RuntimeWorkerResolution } from "./runtime-plan-types.js";

const STAGE_ORDER = [
  { id: "stage-mission", label: "Mission context", kind: "stage" as const },
  { id: "stage-knowledge", label: "Knowledge bind", kind: "stage" as const },
  { id: "stage-planning", label: "Runtime planning", kind: "stage" as const },
  { id: "stage-design", label: "Design brief", kind: "stage" as const },
  { id: "stage-render", label: "Render", kind: "stage" as const },
  { id: "stage-critic", label: "Critic", kind: "stage" as const },
  { id: "stage-gate", label: "Quality gate", kind: "stage" as const },
  { id: "stage-founder", label: "Founder review", kind: "stage" as const },
] as const;

export function buildRuntimeExecutionGraph(
  resolution: RuntimeWorkerResolution,
): RuntimeExecutionGraph {
  const nodes: RuntimePlanNode[] = [];
  let order = 0;

  for (const id of resolution.director) {
    nodes.push({
      id,
      kind: "director",
      label: id,
      order: order++,
      invoked: false,
      informational: true,
    });
  }
  for (const id of resolution.managers) {
    nodes.push({
      id,
      kind: "manager",
      label: id,
      order: order++,
      invoked: false,
      informational: true,
    });
  }
  for (const id of resolution.worker_order) {
    const kind =
      resolution.workers.includes(id)
        ? ("worker" as const)
        : resolution.skills.includes(id)
          ? ("skill" as const)
          : resolution.models.includes(id)
            ? ("model" as const)
            : resolution.tools.includes(id)
              ? ("tool" as const)
              : ("worker" as const);
    nodes.push({
      id,
      kind,
      label: id,
      order: order++,
      invoked: false,
      informational: true,
    });
  }
  for (const stage of STAGE_ORDER) {
    nodes.push({
      id: stage.id,
      kind: stage.kind,
      label: stage.label,
      order: order++,
      invoked: false,
      informational: true,
    });
  }

  const edges: RuntimePlanEdge[] = [];
  const director = resolution.director[0];
  const manager = resolution.managers[0];
  if (director && manager) {
    edges.push({ from: director, to: manager, kind: "orchestrates" });
  }
  if (manager) {
    for (const w of resolution.workers) {
      edges.push({ from: manager, to: w, kind: "orchestrates" });
    }
  }
  for (let i = 0; i < resolution.workers.length; i++) {
    const w = resolution.workers[i]!;
    const skill = resolution.skills[i] ?? resolution.skills[0];
    const model = resolution.models[0];
    const tool = resolution.tools[0];
    if (skill) edges.push({ from: w, to: skill, kind: "uses" });
    if (model) edges.push({ from: w, to: model, kind: "uses" });
    if (tool) edges.push({ from: w, to: tool, kind: "uses" });
  }
  for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
    edges.push({
      from: STAGE_ORDER[i]!.id,
      to: STAGE_ORDER[i + 1]!.id,
      kind: "sequential",
    });
  }
  if (manager) {
    edges.push({
      from: manager,
      to: STAGE_ORDER[0]!.id,
      kind: "orchestrates",
    });
  }

  const topological_order = [
    ...resolution.director,
    ...resolution.managers,
    ...resolution.worker_order,
    ...STAGE_ORDER.map((s) => s.id),
  ];

  return {
    nodes,
    edges,
    critical_path: STAGE_ORDER.map((s) => s.id),
    topological_order,
    note: "Deterministic planning graph · no node is invoked",
  };
}
