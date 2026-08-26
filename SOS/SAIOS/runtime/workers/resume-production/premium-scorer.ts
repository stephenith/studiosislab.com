/**
 * Premium scorer — calibrated multi-axis quality including brand identity dimensions.
 */
import { buildDesignSystemBundle } from "../../design-system/DesignSystemDirector.js";
import { scoreDNAAlignment } from "../../design-system/DesignDNA.js";
import type { DesignQAReport } from "./design-qa.js";
import type { ValidationReport } from "./validator.js";
import type { PremiumIntegrationContext, PremiumScores, PreGenerationChecklist } from "./types-v3.js";
import type { TripleCritiqueReport } from "./types-v3.js";
import type { DuplicateCheckResultV3 } from "./duplicate-detector-v3.js";
import type { ConfidenceScores } from "./types-v2.js";
import { CALIBRATED_SPACING, scoreBand } from "./founder-calibration.js";

export const PREMIUM_TARGET = 95;
const PREMIUM_SCORE_CAP = 96;

export function computePremiumScores(input: {
  integration: PremiumIntegrationContext;
  checklist: PreGenerationChecklist;
  designQa: DesignQAReport;
  validation: ValidationReport;
  duplicate: DuplicateCheckResultV3;
  critiques: TripleCritiqueReport[];
  editor_pass: boolean;
  page_utilization?: number;
}): PremiumScores {
  const q = input.integration.brain_quality;
  const prediction = input.checklist.quality_prediction;
  const system = buildDesignSystemBundle(true);
  const critique_boost = Math.round(
    (input.critiques[2]?.confidence_after ?? 88) - (input.critiques[0]?.confidence_before ?? 85),
  );
  const uniqueness_boost = input.duplicate.exceeds_threshold ? -6 : 2;

  const utilization = input.page_utilization ?? 0.6;
  const utilization_penalty =
    utilization < 0.7 ? -8 : utilization < CALIBRATED_SPACING.page_utilization_target_min ? -5 : utilization > 0.93 ? -3 : 2;

  const hasSignature =
    system.visual_language.spec.signature_id.length > 0 &&
    system.experience_block.spec.role_pt >= 12;
  const roleSplit = system.visual_language.experience.role_company_split;

  const first_impression_score = capPremium(
    q.professional_appearance + uniqueness_boost + (hasSignature ? 4 : 0) + critique_boost / 6,
  );
  const visual_rhythm_score = capPremium(
    q.whitespace + (system.section_rhythm.transitions.summary >= 20 ? 3 : 0) + critique_boost / 7,
  );
  const composition_score = capPremium(
    q.balance + (system.page_width.content_width_px >= 700 ? 3 : 0) + utilization_penalty / 2,
  );
  const density_score = capPremium(
    86 +
      (utilization >= 0.85 && utilization <= 0.93 ? 6 : utilization >= 0.8 ? 3 : 0) +
      (system.content_density.computed.content_width_px >= 700 ? 2 : 0),
  );
  const design_identity_score = capPremium(
    q.premium_perception + (system.premium_identity.spec.accent_marker ? 3 : 0) + uniqueness_boost,
  );
  const brand_identity_score = capPremium(
    88 + (hasSignature ? 5 : 0) + (roleSplit ? 3 : 0) + uniqueness_boost / 2,
  );
  const recognizability_score = capPremium(
    87 +
      (system.visual_language.signature.id.includes("studiosislab") ? 5 : 0) +
      (system.premium_header.composition.accent_bar.width_px >= 96 ? 2 : 0),
  );
  const visual_confidence_score = capPremium(
    first_impression_score * 0.4 + design_identity_score * 0.35 + composition_score * 0.25,
  );
  const attention_flow_score = capPremium(
    85 +
      (roleSplit ? 5 : 0) +
      (system.visual_language.focal_weights.experience >= 0.9 ? 4 : 0) +
      critique_boost / 8,
  );
  const dna_alignment_score = capPremium(
    scoreDNAAlignment({
      name_pt: system.typography.roles.find((r) => r.role === "display")?.size_pt ?? 32,
      margin_px: system.page_width.margins.left_px,
      experience_focal: system.visual_language.focal_weights.experience,
      accent_count: 4,
      section_markers: 5,
      role_company_split: roleSplit,
      signature_id: system.design_dna.resolved.signature_id,
    }),
  );

  const scores = {
    professional_score: capPremium(q.professional_appearance + uniqueness_boost + utilization_penalty / 2),
    premium_score: capPremium(
      (first_impression_score + visual_rhythm_score + design_identity_score + brand_identity_score) / 4,
    ),
    executive_score: input.integration.brain_decisions.premium_feel
      ? capPremium(prediction.predicted_executive + critique_boost / 5 + utilization_penalty / 5)
      : capPremium(prediction.predicted_professional + critique_boost / 5),
    modern_score: capPremium(q.typography + critique_boost / 6 + utilization_penalty / 4),
    originality_score: capPremium(input.integration.brain_decisions.originality_score + uniqueness_boost),
    ats_score: capPremium(q.ats_compatibility - (utilization > 0.92 ? 2 : 0)),
    accessibility_score: capPremium(q.accessibility),
    user_appeal_prediction: capPremium(
      prediction.predicted_user_appeal + critique_boost / 4 + first_impression_score / 25,
    ),
    click_prediction: capPremium(prediction.predicted_click + critique_boost / 5 + brand_identity_score / 30),
    download_prediction: capPremium(
      prediction.predicted_download + critique_boost / 4 + (first_impression_score + density_score) / 45,
    ),
    first_impression_score,
    visual_rhythm_score,
    composition_score,
    density_score,
    design_identity_score,
    brand_identity_score,
    recognizability_score,
    visual_confidence_score,
    attention_flow_score,
    dna_alignment_score,
  };

  const premium_axes = [
    scores.first_impression_score,
    scores.visual_rhythm_score,
    scores.composition_score,
    scores.density_score,
    scores.design_identity_score,
    scores.brand_identity_score,
    scores.recognizability_score,
    scores.attention_flow_score,
    scores.dna_alignment_score,
    scores.premium_score,
    scores.ats_score,
  ];
  const raw_overall = Math.round(premium_axes.reduce((a, b) => a + b, 0) / premium_axes.length);

  const qa_pass = input.designQa.pass && input.validation.pass && input.editor_pass;
  const calibrated = clamp(raw_overall + (qa_pass ? 0 : -5));
  const overall_confidence = calibrated;

  return {
    ...scores,
    overall_confidence,
    target_met: overall_confidence >= PREMIUM_TARGET && scoreBand(overall_confidence) !== "needs_improvement",
    computed_at: new Date().toISOString(),
  };
}

export function toConfidenceScores(premium: PremiumScores): ConfidenceScores {
  return {
    design_confidence: premium.premium_score,
    ats_confidence: premium.ats_score,
    visual_confidence: premium.modern_score,
    editor_compatibility: Math.min(100, premium.professional_score),
    overall_confidence: premium.overall_confidence,
    target_met: premium.target_met,
    computed_at: premium.computed_at,
  };
}

function capPremium(n: number): number {
  return clamp(Math.min(PREMIUM_SCORE_CAP, n));
}

function clamp(n: number): number {
  return Math.min(100, Math.max(50, Math.round(n)));
}
