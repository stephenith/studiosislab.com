/**
 * Design planner — assemble the single authoritative Design Brief.
 */
import { randomUUID } from "node:crypto";
import type {
  ATSPlan,
  ColorPlan,
  DesignBrief,
  FirecrawlResearchSummary,
  IndustryAnalysis,
  LayoutPlan,
  TemplateComparison,
  TypographyPlan,
} from "./types.js";

export function buildDesignBrief(input: {
  session_id: string;
  objective: string;
  industry: IndustryAnalysis;
  comparison: TemplateComparison;
  firecrawl: FirecrawlResearchSummary;
  typography: TypographyPlan;
  color: ColorPlan;
  layout: LayoutPlan;
  ats: ATSPlan;
  cursor_summary: string;
}): DesignBrief {
  const risks: string[] = [];
  if (!input.comparison.pass_uniqueness) {
    risks.push(
      `Similarity to existing templates may exceed ${input.comparison.target_similarity_max * 100}% — differentiate layout`,
    );
  }
  if (input.industry.ats_sensitivity === "high" && input.ats.compatibility_tier !== "ats_safe") {
    risks.push("ATS sensitivity high but tier not ats_safe — review before generation");
  }
  if (input.comparison.most_similar_templates[0]) {
    risks.push(
      `Most similar template: ${input.comparison.most_similar_templates[0].template_id} (${input.comparison.most_similar_templates[0].family})`,
    );
  }

  const confidence = Math.round(
    (input.industry.confidence +
      input.comparison.uniqueness_score +
      input.typography.readability_score +
      input.color.accessibility_score +
      input.ats.parse_reliability_score) /
      5,
  );

  const research_summary = [
    input.cursor_summary,
    input.firecrawl.mcp_available
      ? `External research: ${input.firecrawl.findings.length} topics summarized (temporary).`
      : "External research skipped (Firecrawl MCP unavailable).",
    `Corpus comparison: uniqueness ${input.comparison.uniqueness_score}%, target max similarity ${input.comparison.target_similarity_max * 100}%.`,
  ].join(" ");

  return {
    brief_id: `brief-${randomUUID().slice(0, 8)}`,
    session_id: input.session_id,
    generated_at: new Date().toISOString(),
    objective: input.objective,
    industry: input.industry.industry,
    target_user: `${input.industry.experience_level} ${input.industry.industry} professional`,
    ats_strategy: `${input.ats.compatibility_tier} — parse reliability ${input.ats.parse_reliability_score}%`,
    layout_strategy: `${input.layout.structure} with ${input.layout.column_structure} columns`,
    typography_plan: input.typography,
    color_plan: input.color,
    spacing_plan: {
      section_gap_px: input.typography.spacing.section_gap_px,
      margin_px: input.layout.margins_px.left,
      whitespace_notes: input.layout.whitespace_strategy,
    },
    section_plan: {
      order: input.layout.section_order,
      optional: ["certifications", "projects", "languages"],
    },
    research_summary,
    studiosislab_comparison: input.comparison,
    improvement_opportunities: input.comparison.improvement_opportunities,
    risk_assessment: risks,
    confidence,
    ats_plan: input.ats,
    layout_plan: input.layout,
  };
}
