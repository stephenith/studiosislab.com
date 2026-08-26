/**
 * SimulationTimeline — Agent #187.
 * Metadata only. executed=false on every step.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type { SimulationTimelineStep } from "./SimulationTypes.js";
import { SIMULATION_GRAPH_ORDER } from "./SimulationGraph.js";

const STEP_MS = 1000;

export function buildSimulationTimeline(input?: {
  timeline_id?: string;
}): {
  timeline_id: string;
  steps: SimulationTimelineStep[];
  estimated_duration_ms: number;
  timeline_checksum: string;
} {
  const timeline_id = input?.timeline_id ?? `stl-${randomUUID().slice(0, 8)}`;
  const steps: SimulationTimelineStep[] = SIMULATION_GRAPH_ORDER.map(
    (node_id, i) => ({
      step_id: `${timeline_id}-step-${i + 1}`,
      node_id,
      label: `Simulate ${node_id}`,
      sequence: i + 1,
      estimated_duration_ms: STEP_MS,
      executed: false as const,
    }),
  );
  const estimated_duration_ms = steps.reduce(
    (a, s) => a + s.estimated_duration_ms,
    0,
  );
  const timeline_checksum = sha256Canonical({
    timeline_id,
    steps,
    estimated_duration_ms,
  });
  return { timeline_id, steps, estimated_duration_ms, timeline_checksum };
}

export function assertTimelineIntegrity(
  steps: SimulationTimelineStep[],
): boolean {
  if (steps.length !== SIMULATION_GRAPH_ORDER.length) return false;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    if (s.sequence !== i + 1) return false;
    if (s.node_id !== SIMULATION_GRAPH_ORDER[i]) return false;
    if (s.executed !== false) return false;
  }
  return true;
}
