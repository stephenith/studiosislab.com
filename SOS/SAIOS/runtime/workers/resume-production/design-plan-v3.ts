/**
 * Design plan v3 — brain-driven plan before Fabric JSON.
 */
import { randomUUID } from "node:crypto";
import type { FamilySelectionResult } from "./family-selector.js";
import type { DesignPlan } from "./types-v2.js";
import type { PremiumIntegrationContext } from "./types-v3.js";
import type { DuplicateCheckResultV3 } from "./duplicate-detector-v3.js";

import type { ProductionDesignBundle } from "./design-bundle.js";

export function buildDesignPlanV3(input: {
  objective: string;
  integration: PremiumIntegrationContext;
  family: FamilySelectionResult;
  duplicate: DuplicateCheckResultV3;
  industry: string;
  design_bundle: ProductionDesignBundle;
}): DesignPlan {
  const brain = input.integration.brain_decisions;
  const resolved = input.design_bundle.resolved;

  return {
    plan_id: `plan-v3-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    objective: input.objective,
    layout: `${input.design_bundle.selection.layout_id} — ${brain.design_language}`,
    grid: `${input.design_bundle.selection.grid_id} — design-system controlled`,
    spacing: {
      margin_px: resolved.margin_left,
      section_gap_px: resolved.section_gap_px,
      paragraph_gap_px: resolved.paragraph_gap_px,
    },
    columns: input.design_bundle.design_system.grid.layouts.find(
      (g) => g.id === input.design_bundle.selection.grid_id,
    )?.columns === 1
      ? "single"
      : "multi",
    font_hierarchy: input.design_bundle.design_system.typography.roles.map((r) => ({
      role: r.role,
      size_pt: r.size_pt,
      weight: r.weight,
    })),
    color_palette: {
      accent: resolved.accent,
      text: resolved.color_text,
      muted: resolved.color_muted,
      background: "#FFFFFF",
    },
    sections: resolved.section_order,
    ats_tier: brain.ats_mode === "ats_first" ? "ats_safe" : "hybrid",
    visual_tier: brain.premium_feel ? "visual" : "ats_safe",
    design_reasoning: [
      ...brain.reasoning,
      ...input.family.rationale,
      `Benchmark patterns: ${input.integration.benchmark_patterns_used.length} applied`,
      `Industry: ${input.industry}`,
      `Uniqueness: ${input.duplicate.uniqueness_score}%`,
    ],
    expected_recruiter_impression: brain.premium_feel
      ? "Executive premium resume — calm hierarchy, confident whitespace, ATS-safe structure"
      : "Modern professional resume — clear scan path, industry-appropriate tone",
    family_id: input.family.selected_family_id,
    differentiation_notes: input.duplicate.comparison.improvement_opportunities.slice(0, 5),
  };
}
