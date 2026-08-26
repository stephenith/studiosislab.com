/**
 * V3 learning append — benchmark patterns, layout rationale, originality decisions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PreGenerationChecklist, PremiumIntegrationContext, PremiumScores } from "./types-v3.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
const V3_APPEND_ROOT = join(SOS_ROOT, "07_LOGS/saios/learning/worker-v3-append.json");

export type LearningAppendV3Entry = {
  appended_at: string;
  prototype_id: string;
  family_id: string;
  layout_selection_reason: string;
  benchmark_patterns_influenced: string[];
  founder_preferences_applied: string[];
  originality_decisions: string[];
  premium_scores: PremiumScores;
};

export function appendLearningRecordV3(input: {
  prototype_id: string;
  checklist: PreGenerationChecklist;
  integration: PremiumIntegrationContext;
  premium_scores: PremiumScores;
  persist?: boolean;
}): LearningAppendV3Entry {
  const entry: LearningAppendV3Entry = {
    appended_at: new Date().toISOString(),
    prototype_id: input.prototype_id,
    family_id: input.checklist.layout_selection.selected_family_id,
    layout_selection_reason: input.checklist.layout_selection.rationale.join("; "),
    benchmark_patterns_influenced: input.integration.benchmark_patterns_used.slice(0, 5),
    founder_preferences_applied: input.integration.learning_notes,
    originality_decisions: [
      `Uniqueness ${input.checklist.originality_check.uniqueness_score}%`,
      input.checklist.originality_check.redesign_required
        ? "Redesigned to avoid >70% similarity"
        : "Originality within threshold",
      `Brain originality score: ${input.integration.brain_decisions.originality_score}`,
    ],
    premium_scores: input.premium_scores,
  };

  if (input.persist !== false) {
    mkdirSync(join(SOS_ROOT, "07_LOGS/saios/learning"), { recursive: true });
    const prior: LearningAppendV3Entry[] = existsSync(V3_APPEND_ROOT)
      ? JSON.parse(readFileSync(V3_APPEND_ROOT, "utf8"))
      : [];
    prior.push(entry);
    writeFileSync(V3_APPEND_ROOT, JSON.stringify(prior, null, 2));
  }

  return entry;
}
