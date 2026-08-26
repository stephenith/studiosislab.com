/**
 * SimulationLearning — Agent #187.
 * Expected learning artifacts only. No writes.
 */
import { randomUUID } from "node:crypto";
import type { SimulationLearningRef } from "./SimulationTypes.js";

export function buildLearningRef(input?: {
  learning_plan_id?: string;
}): SimulationLearningRef {
  return {
    learning_plan_id:
      input?.learning_plan_id ?? `slp-${randomUUID().slice(0, 8)}`,
    expected_artifacts: [
      "expected_critic_signal",
      "expected_layout_feedback",
      "expected_founder_preference_note",
    ],
    writes: false,
    knowledge_updates: false,
    append_operations: false,
  };
}

export function assertLearningIntegrity(ref: SimulationLearningRef): boolean {
  return (
    ref.writes === false &&
    ref.knowledge_updates === false &&
    ref.append_operations === false &&
    ref.expected_artifacts.length > 0
  );
}
