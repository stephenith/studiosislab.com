/**
 * Canonical Research Context — Agent #206.
 * Supporting research for a ProductionTarget (deterministic; no AI planner).
 */
import type { ProductionCategory, ProductionTarget } from "./ProductionTarget.js";

export type ResearchContext = {
  category: ProductionCategory;
  title: string;
  industry: string;
  seniority: string;
  ats_guidance: {
    compatibility_tier: "ats_safe" | "hybrid" | "visual";
    parse_reliability_score: number;
    keyword_strategy: string[];
    forbidden_elements: string[];
    heading_structure: string[];
    text_hierarchy_rules: string[];
  };
  typography_guidance: {
    font_family: string;
    body_size_pt: number;
    heading_scale: number[];
    line_height: number;
    visual_density: "compact" | "balanced" | "airy";
    accessibility_notes: string[];
  };
  layout_guidance: {
    structure: string;
    columns: 1 | 2;
    margins_mm: { top: number; right: number; bottom: number; left: number };
    section_order: string[];
    reading_flow: string;
    whitespace_strategy: string;
  };
  industry_guidance: {
    hiring_style: string;
    ats_sensitivity: "high" | "medium" | "low";
    expected_resume_length: "one_page" | "two_page";
    visual_preference: string;
    target_recruiter_style: string;
  };
  writing_recommendations: string[];
  design_constraints: string[];
  research_sources: string[];
  generated_at: string;
  deterministic: true;
  ai_planner: false;
};

/** Compact briefing for ReasoningRequest.instructions (OpenAI enrichment). */
export function formatResearchBriefing(ctx: ResearchContext): string {
  return [
    `ResearchContext[category=${ctx.category}; title=${ctx.title}; industry=${ctx.industry}; seniority=${ctx.seniority}]`,
    `ATS[tier=${ctx.ats_guidance.compatibility_tier}; score=${ctx.ats_guidance.parse_reliability_score}; forbid=${ctx.ats_guidance.forbidden_elements.slice(0, 4).join("|")}]`,
    `Typography[font=${ctx.typography_guidance.font_family}; body=${ctx.typography_guidance.body_size_pt}pt; density=${ctx.typography_guidance.visual_density}]`,
    `Layout[structure=${ctx.layout_guidance.structure}; columns=${ctx.layout_guidance.columns}; sections=${ctx.layout_guidance.section_order.join(">")}]`,
    `Industry[hiring=${ctx.industry_guidance.hiring_style}; ats=${ctx.industry_guidance.ats_sensitivity}; length=${ctx.industry_guidance.expected_resume_length}]`,
    `Writing[${ctx.writing_recommendations.slice(0, 3).join("; ")}]`,
    `Constraints[${ctx.design_constraints.slice(0, 3).join("; ")}]`,
  ].join(" · ");
}

export function assertResearchContext(ctx: ResearchContext | null | undefined): boolean {
  if (!ctx) return false;
  return (
    Boolean(ctx.category) &&
    Boolean(ctx.ats_guidance?.compatibility_tier) &&
    Boolean(ctx.typography_guidance?.font_family) &&
    Boolean(ctx.layout_guidance?.section_order?.length) &&
    Boolean(ctx.industry_guidance?.hiring_style) &&
    Array.isArray(ctx.research_sources) &&
    ctx.research_sources.length > 0 &&
    ctx.deterministic === true &&
    ctx.ai_planner === false
  );
}

export type { ProductionTarget };
