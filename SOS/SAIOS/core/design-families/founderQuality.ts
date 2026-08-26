/**
 * Agent #239 — Founder-quality publishability classification.
 * Recommendation only — does not publish or change LIVE.
 */

export type PublishabilityClass =
  | "PUBLISHABLE"
  | "NEEDS_REFINEMENT"
  | "REGENERATE";

export type FounderQualityInput = {
  design: number;
  ats: number;
  editor_pass: boolean;
  thumbnail_appeal: number;
  contrast_pass: boolean;
  safe_area_pass: boolean;
  nearest_similarity: number;
  similarity_threshold: number;
  major_lower_void: boolean;
  dimension_mins: Record<string, number>;
};

export function classifyFounderQuality(
  input: FounderQualityInput,
): {
  class: PublishabilityClass;
  reasons: string[];
} {
  const reasons: string[] = [];
  const dimFail = Object.entries(input.dimension_mins).filter(
    ([, v]) => v < 80,
  );
  if (dimFail.length) {
    reasons.push(
      `Dimension(s) below 80: ${dimFail.map(([k, v]) => `${k}=${v}`).join(", ")}`,
    );
  }
  if (!input.editor_pass) reasons.push("Editor compatibility failed");
  if (input.ats < 70) reasons.push(`ATS ${input.ats} < 70`);
  if (!input.contrast_pass) reasons.push("Contrast failed");
  if (!input.safe_area_pass) reasons.push("Safe-area geometry failed");
  if (input.major_lower_void) reasons.push("Major lower-page void");
  if (input.nearest_similarity >= input.similarity_threshold) {
    reasons.push(
      `Near-duplicate similarity ${input.nearest_similarity.toFixed(2)}`,
    );
  }

  const hardRegen =
    input.design < 80 ||
    !input.contrast_pass ||
    !input.safe_area_pass ||
    input.major_lower_void ||
    input.nearest_similarity >= input.similarity_threshold ||
    !input.editor_pass ||
    input.ats < 70;

  if (hardRegen) {
    return { class: "REGENERATE", reasons };
  }

  const publishable =
    input.design >= 90 &&
    input.ats >= 70 &&
    input.editor_pass &&
    input.thumbnail_appeal >= 85 &&
    input.contrast_pass &&
    input.safe_area_pass &&
    input.nearest_similarity < input.similarity_threshold &&
    !input.major_lower_void &&
    dimFail.length === 0;

  if (publishable) {
    return { class: "PUBLISHABLE", reasons: reasons.length ? reasons : ["Meets Founder bar"] };
  }

  if (input.design >= 80 && input.design < 90) {
    reasons.push(`Design ${input.design} in 80–89 NEEDS_REFINEMENT band`);
  }
  if (input.thumbnail_appeal < 85) {
    reasons.push(`Thumbnail ${input.thumbnail_appeal} < 85`);
  }

  return {
    class: "NEEDS_REFINEMENT",
    reasons,
  };
}
