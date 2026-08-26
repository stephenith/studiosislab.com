/**
 * Provisional critic learning — never founder-approved.
 */
import { randomUUID } from "node:crypto";
import { LearningRepository } from "../knowledge-learning/LearningRepository.js";
import { persistLearningSnapshot } from "../knowledge-learning/LearningSnapshotBuilder.js";
import type { LearningEntry } from "../knowledge-learning/types.js";
import type { CriticGateResult } from "./types.js";

export function writeProvisionalCriticLearning(
  gate: CriticGateResult,
): LearningEntry[] {
  if (gate.ready || gate.fixture) return [];

  const clean: LearningEntry = {
    learning_id: `lrn-critic-${randomUUID().slice(0, 10)}`,
    source_decision_id: "critic-gate-provisional",
    source_review_id: gate.candidate_id,
    source_task_id: gate.task_id,
    department: "resume",
    category: "quality_observation",
    subject: `Critic blocked pattern: ${gate.blocking_reasons[0] ?? "unknown"}`,
    observation: `Deterministic critic blocked resume template (source=deterministic_critic). Reasons: ${gate.blocking_reasons.join("; ")}. Not founder-approved learning.`,
    evidence_references: [gate.critic_report_reference, `gate:${gate.gate_id}`],
    confidence: "observed",
    applicability: ["resume"],
    approved_by_founder: false,
    supersedes: null,
    created_at: new Date().toISOString(),
    version: "1",
  };

  const repo = new LearningRepository();
  repo.appendMany([clean]);
  persistLearningSnapshot(repo.list());
  return [clean];
}
