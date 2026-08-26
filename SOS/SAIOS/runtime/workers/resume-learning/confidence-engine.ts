/**
 * Confidence scoring for generated templates (0–100).
 */
import type { ConfidenceScore, DesignMemory, QualityHistory } from "./types.js";

export type ConfidenceInput = {
  template_id: string;
  qa_pass?: boolean;
  ats_tier?: "ats_safe" | "visual";
  family_id?: string;
  prototype_scores?: { ats?: number; design?: number };
};

export function computeConfidence(
  input: ConfidenceInput,
  memory: DesignMemory,
  quality: QualityHistory,
): ConfidenceScore {
  const ats = computeAtsComponent(input, memory);
  const design_quality = computeDesignComponent(input, memory);
  const historical_approval = computeHistoricalComponent(input, memory, quality);
  const similarity_to_approved = computeSimilarityComponent(input, memory);

  const overall = Math.round(
    ats * 0.3 + design_quality * 0.25 + historical_approval * 0.25 + similarity_to_approved * 0.2,
  );

  return {
    template_id: input.template_id,
    overall_confidence: clamp(overall, 0, 100),
    components: {
      ats: clamp(Math.round(ats), 0, 100),
      design_quality: clamp(Math.round(design_quality), 0, 100),
      historical_approval: clamp(Math.round(historical_approval), 0, 100),
      similarity_to_approved: clamp(Math.round(similarity_to_approved), 0, 100),
    },
    computed_at: new Date().toISOString(),
  };
}

function computeAtsComponent(input: ConfidenceInput, memory: DesignMemory): number {
  let score = input.prototype_scores?.ats ?? (input.ats_tier === "ats_safe" ? 88 : 72);
  if (input.qa_pass) score += 5;
  const target = memory.preferred_ats_score;
  score = score * 0.7 + target * 0.3;
  return score;
}

function computeDesignComponent(input: ConfidenceInput, memory: DesignMemory): number {
  let score = input.prototype_scores?.design ?? 75;
  if (input.qa_pass) score += 8;
  score = score * 0.6 + memory.preferred_visual_score * 0.4;
  if (memory.preferred_visual_density === "spacious") score += 2;
  return score;
}

function computeHistoricalComponent(
  input: ConfidenceInput,
  memory: DesignMemory,
  quality: QualityHistory,
): number {
  if (quality.reviews.length === 0) return 65;
  if (memory.rejected_layouts.includes(input.template_id)) return 25;
  if (memory.accepted_layouts.includes(input.template_id)) return 95;
  return quality.approval_percentage > 0 ? quality.approval_percentage : 60;
}

function computeSimilarityComponent(input: ConfidenceInput, memory: DesignMemory): number {
  if (memory.accepted_layouts.length === 0) return 70;
  const family = input.family_id ?? "unknown";
  const acceptedFamilies = memory.accepted_layouts.filter((id) => id.includes(family.replace(/-/g, "")));
  if (acceptedFamilies.length > 0) return 90;
  if (memory.rejected_layouts.some((id) => id === input.template_id)) return 30;
  return 75;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computeConfidenceBatch(
  templates: ConfidenceInput[],
  memory: DesignMemory,
  quality: QualityHistory,
): ConfidenceScore[] {
  return templates.map((t) => computeConfidence(t, memory, quality));
}
