/**
 * Design plan — produced before Fabric JSON generation.
 */
import { randomUUID } from "node:crypto";
import type { FamilySelectionResult } from "./family-selector.js";
import type { DesignPlan } from "./types-v2.js";
import type { KnowledgeContext } from "./knowledge-context.js";
import type { DuplicateCheckResult } from "./duplicate-detector.js";

export function buildDesignPlan(input: {
  objective: string;
  ctx: KnowledgeContext;
  family: FamilySelectionResult;
  duplicate: DuplicateCheckResult;
  industry: string;
}): DesignPlan {
  const memory = input.ctx.learning_memory;

  return {
    plan_id: `plan-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    objective: input.objective,
    layout: "single-column modern professional",
    grid: "8px alignment grid, 56px horizontal margins",
    spacing: {
      margin_px: memory.preferred_spacing.margin_px,
      section_gap_px: memory.preferred_spacing.min_section_gap_px,
      paragraph_gap_px: memory.preferred_spacing.min_paragraph_gap_px,
    },
    columns: "single",
    font_hierarchy: [
      { role: "name", size_pt: 26, weight: "bold" },
      { role: "title", size_pt: 13, weight: "medium" },
      { role: "section_heading", size_pt: 11, weight: "bold" },
      { role: "body", size_pt: memory.preferred_typography.min_body_pt, weight: "regular" },
    ],
    color_palette: {
      accent: memory.preferred_colors.accent[0] ?? "#2563eb",
      text: memory.preferred_colors.body_text,
      muted: "#6b7280",
      background: "#ffffff",
    },
    sections: memory.preferred_sections.order.length
      ? memory.preferred_sections.order
      : ["summary", "experience", "education", "skills", "certifications"],
    ats_tier: "ats_safe",
    visual_tier: "ats_safe",
    design_reasoning: [
      ...input.family.rationale,
      `Industry context: ${input.industry}`,
      `Corpus templates analyzed: ${input.ctx.corpus_template_count}`,
      `Uniqueness score: ${input.duplicate.uniqueness_score}%`,
      input.duplicate.redesign_required
        ? "Alternate family selected to reduce >70% similarity"
        : "Similarity within acceptable range",
    ],
    expected_recruiter_impression:
      "Clean, confident, ATS-parseable professional resume with clear hierarchy and calm accent color",
    family_id: input.family.selected_family_id,
    differentiation_notes: input.duplicate.comparison.improvement_opportunities.slice(0, 5),
  };
}
