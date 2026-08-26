/**
 * SimulationGraph — Agent #187.
 * Every node executed=false.
 */
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  SimulationGraphNode,
  SimulationGraphNodeId,
} from "./SimulationTypes.js";

export const SIMULATION_GRAPH_ORDER: SimulationGraphNodeId[] = [
  "founder",
  "mission",
  "approval",
  "queue_admission",
  "execution_package",
  "package_ack",
  "queue_submission",
  "shadow_queue",
  "runtime_plan",
  "runtime_release",
  "system_readiness",
  "activation_gate",
  "execution_authorization",
  "execution_controller",
  "department",
  "workers",
  "learning",
];

const LABELS: Record<SimulationGraphNodeId, string> = {
  founder: "Founder",
  mission: "Mission",
  approval: "Approval",
  queue_admission: "Queue Admission",
  execution_package: "Execution Package",
  package_ack: "Package Ack",
  queue_submission: "Queue Submission",
  shadow_queue: "Shadow Queue",
  runtime_plan: "Runtime Plan",
  runtime_release: "Runtime Release",
  system_readiness: "System Readiness",
  activation_gate: "Activation Gate",
  execution_authorization: "Execution Authorization",
  execution_controller: "Execution Controller",
  department: "Department",
  workers: "Workers",
  learning: "Learning",
};

export function buildSimulationGraph(): {
  graph_id: string;
  nodes: SimulationGraphNode[];
  edges: Array<{ from: SimulationGraphNodeId; to: SimulationGraphNodeId }>;
  graph_checksum: string;
} {
  const nodes: SimulationGraphNode[] = SIMULATION_GRAPH_ORDER.map(
    (node_id, i) => ({
      node_id,
      label: LABELS[node_id],
      order: i,
      executed: false as const,
      simulated: true as const,
      depends_on:
        i === 0 ? [] : ([SIMULATION_GRAPH_ORDER[i - 1]!] as SimulationGraphNodeId[]),
    }),
  );
  const edges = nodes
    .filter((n) => n.depends_on.length > 0)
    .map((n) => ({ from: n.depends_on[0]!, to: n.node_id }));
  const graph_id = `sgraph-${nodes.length}-nodes`;
  const graph_checksum = sha256Canonical({ graph_id, nodes, edges });
  return { graph_id, nodes, edges, graph_checksum };
}

export function assertGraphIntegrity(nodes: SimulationGraphNode[]): boolean {
  if (nodes.length !== SIMULATION_GRAPH_ORDER.length) return false;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (n.node_id !== SIMULATION_GRAPH_ORDER[i]) return false;
    if (n.executed !== false) return false;
    if (n.order !== i) return false;
  }
  const ids = new Set(nodes.map((n) => n.node_id));
  return ids.size === nodes.length;
}
