/**
 * Append successful design decisions to learning memory (append-only).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DesignPlan } from "./types-v2.js";
import type { ConfidenceScores } from "./types-v2.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
const LEARNING_APPEND_ROOT = join(SOS_ROOT, "07_LOGS/saios/learning/worker-v2-append.json");

export type LearningAppendEntry = {
  appended_at: string;
  prototype_id: string;
  spacing_improvements: string[];
  typography_improvements: string[];
  industry_notes: string[];
  founder_preferences_applied: string[];
  future_recommendations: string[];
  confidence: ConfidenceScores;
};

export function appendLearningRecord(input: {
  prototype_id: string;
  plan: DesignPlan;
  confidence: ConfidenceScores;
  persist?: boolean;
}): LearningAppendEntry {
  const entry: LearningAppendEntry = {
    appended_at: new Date().toISOString(),
    prototype_id: input.prototype_id,
    spacing_improvements: [
      `Section gap ${input.plan.spacing.section_gap_px}px`,
      `Margins ${input.plan.spacing.margin_px}px`,
    ],
    typography_improvements: input.plan.font_hierarchy.map(
      (f) => `${f.role}: ${f.size_pt}pt ${f.weight}`,
    ),
    industry_notes: [input.plan.objective],
    founder_preferences_applied: input.plan.design_reasoning.slice(0, 3),
    future_recommendations: input.plan.differentiation_notes,
    confidence: input.confidence,
  };

  if (input.persist !== false) {
    mkdirSync(join(SOS_ROOT, "07_LOGS/saios/learning"), { recursive: true });
    const prior: LearningAppendEntry[] = existsSync(LEARNING_APPEND_ROOT)
      ? JSON.parse(readFileSync(LEARNING_APPEND_ROOT, "utf8"))
      : [];
    prior.push(entry);
    writeFileSync(LEARNING_APPEND_ROOT, JSON.stringify(prior, null, 2));
  }

  return entry;
}
