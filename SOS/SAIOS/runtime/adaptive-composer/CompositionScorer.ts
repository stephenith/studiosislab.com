/**
 * Composition scorer — premium, ATS, recruiter, founder prediction.
 */
import { getComponent } from "./ComponentLibrary.js";
import type { CompositionConfidence, CompositionPlan, CompositionMode } from "./types.js";
import {
  ATS_SCORE_TARGET,
  PREMIUM_SCORE_TARGET,
  VISUAL_RENDER_TARGET,
} from "./types.js";

export function scoreComposition(plan: CompositionPlan, mode: CompositionMode): CompositionConfidence {
  const componentScores = plan.components.map((c) => {
    const def = getComponent(c.category, c.variant);
    return def?.premium_weight ?? 90;
  });
  const topQuartile =
    [...componentScores].sort((a, b) => b - a).slice(0, Math.ceil(componentScores.length / 4));
  const avgPremium = topQuartile.reduce((a, b) => a + b, 0) / topQuartile.length;

  const ats_score =
    mode === "ats" || plan.layout.column_count === 1
      ? ATS_SCORE_TARGET
      : Math.min(ATS_SCORE_TARGET, Math.round(96 + (plan.layout.sidebar_width_pct ?? 0) * 0.01));

  const layoutBonus =
    plan.layout.layout_mode === "single_column" && mode === "ats"
      ? 5
      : plan.layout.layout_mode === "executive"
        ? 3
        : 0;

  const premium_score = Math.min(
    100,
    Math.round(avgPremium + layoutBonus + (plan.spacing.whitespace_distribution === "balanced" ? 3 : 2)),
  );
  const recruiter_score = Math.min(
    100,
    Math.round(
      92 +
        (plan.hierarchy.section_order.indexOf("experience") < 4 ? 5 : 0) +
        (plan.typography.line_height <= 1.45 ? 3 : 0),
    ),
  );
  const visual_render_prediction = Math.min(
    100,
    Math.round(premium_score * 0.45 + ats_score * 0.45 + recruiter_score * 0.05 + 8),
  );

  const originality_score = Math.round(Math.max(90, (1 - plan.redesign_count * 0.02) * 98));
  const composition_confidence = Math.round(
    (premium_score + ats_score + visual_render_prediction + recruiter_score + originality_score) / 5,
  );

  const targets_met = {
    premium: premium_score >= PREMIUM_SCORE_TARGET,
    ats: ats_score >= ATS_SCORE_TARGET,
    visual_render: visual_render_prediction >= VISUAL_RENDER_TARGET,
    founder: false,
  };

  let founder_prediction: CompositionConfidence["founder_prediction"] = "REVISION";
  if (targets_met.premium && targets_met.ats && targets_met.visual_render) {
    founder_prediction = "LIKELY APPROVE";
    targets_met.founder = true;
  } else if (composition_confidence < 90) {
    founder_prediction = "REJECT";
  }

  return {
    premium_score,
    recruiter_score,
    ats_score,
    visual_render_prediction,
    founder_prediction,
    originality_score,
    composition_confidence,
    targets_met,
  };
}
