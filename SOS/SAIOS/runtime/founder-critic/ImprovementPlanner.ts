/**
 * Improvement planner — actionable recommendations with impact estimates.
 */
import { randomUUID } from "node:crypto";
import type { CritiqueItem, ImprovementPlan, LoadedTemplateContext } from "./types.js";

export function buildImprovementPlan(input: {
  ctx: LoadedTemplateContext;
  critiques: CritiqueItem[];
  overall_score: number;
}): ImprovementPlan {
  const recommendations = input.critiques.map((c) => toRecommendation(c, input.overall_score));

  if (input.overall_score < 95) {
    recommendations.unshift({
      id: `rec-${randomUUID().slice(0, 6)}`,
      recommendation: "Block founder review until QA and visual scores reach 95+",
      priority: "critical",
      reason: "Overall score below founder critic rejection threshold",
      expected_impact: "Prevents low-quality founder review cycles",
      difficulty: "moderate",
      confidence: 92,
      estimated_visual_gain: 8,
    });
  }

  const total_estimated_gain = recommendations.reduce((a, r) => a + r.estimated_visual_gain, 0);

  return {
    plan_id: `improve-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    prototype_id: input.ctx.prototype_id,
    recommendations,
    total_estimated_gain,
  };
}

function toRecommendation(c: CritiqueItem, overall: number) {
  const priority =
    c.severity === "high" ? "high" : c.severity === "medium" ? "medium" : "low";
  const gain = c.severity === "high" ? 6 : c.severity === "medium" ? 4 : 2;
  return {
    id: c.id.replace("critique", "rec"),
    recommendation: c.feedback,
    priority: overall < 95 && c.severity !== "low" ? ("critical" as const) : priority,
    reason: `Founder critic flagged ${c.category.replace(/_/g, " ")}`,
    expected_impact:
      c.category.includes("premium") || c.category.includes("hierarchy")
        ? "Higher founder approval and user download likelihood"
        : "Improved recruiter scanability and ATS confidence",
    difficulty: c.severity === "high" ? ("moderate" as const) : ("easy" as const),
    confidence: c.severity === "high" ? 88 : 82,
    estimated_visual_gain: gain,
  };
}
