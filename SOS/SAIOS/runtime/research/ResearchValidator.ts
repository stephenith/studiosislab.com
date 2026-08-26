/**
 * Research validator — ensure all planning stages are complete before PASS.
 */
import type {
  ATSPlan,
  ColorPlan,
  DesignBrief,
  FirecrawlResearchSummary,
  IndustryAnalysis,
  LayoutPlan,
  ResearchSession,
  TemplateComparison,
  TypographyPlan,
  ValidationResult,
} from "./types.js";

export function validateResearchSession(session: ResearchSession): ValidationResult {
  const checks: Record<string, boolean> = {
    research_complete: Boolean(session.cursor_result?.success),
    industry_complete: isIndustryComplete(session.industry_analysis),
    template_comparison_complete: isComparisonComplete(session.template_comparison),
    firecrawl_complete: isFirecrawlComplete(session.firecrawl),
    typography_complete: isTypographyComplete(session.typography_plan),
    color_complete: isColorComplete(session.color_plan),
    layout_complete: isLayoutComplete(session.layout_plan),
    ats_complete: isATSComplete(session.ats_plan),
    design_brief_complete: isDesignBriefComplete(session.design_brief),
  };

  const errors: string[] = [];
  if (!checks.research_complete) errors.push("Cursor research incomplete or failed");
  if (!checks.template_comparison_complete) errors.push("Template comparison incomplete");
  if (!checks.design_brief_complete) errors.push("Design brief incomplete");

  const pass = Object.values(checks).every(Boolean);

  return { pass, checks, errors };
}

function isIndustryComplete(a: IndustryAnalysis): boolean {
  return Boolean(a.industry && a.hiring_style && a.ats_sensitivity);
}

function isComparisonComplete(c: TemplateComparison): boolean {
  return (
    c.most_similar_templates.length > 0 &&
    c.uniqueness_score > 0 &&
    c.reusable_ideas.length > 0
  );
}

function isFirecrawlComplete(f: FirecrawlResearchSummary): boolean {
  if (!f.mcp_available) return true;
  return f.findings.length > 0 && f.copyright_safe && !f.copied_layouts;
}

function isTypographyComplete(t: TypographyPlan): boolean {
  return Boolean(t.font_family && t.heading_hierarchy.length >= 2 && t.readability_score > 0);
}

function isColorComplete(c: ColorPlan): boolean {
  return Boolean(c.primary_accent && c.background && c.accessibility_score > 0);
}

function isLayoutComplete(l: LayoutPlan): boolean {
  return Boolean(l.structure && l.section_order.length >= 3);
}

function isATSComplete(a: ATSPlan): boolean {
  return Boolean(a.compatibility_tier && a.forbidden_elements.length > 0);
}

function isDesignBriefComplete(b: DesignBrief): boolean {
  return Boolean(
    b.brief_id &&
      b.objective &&
      b.confidence > 0 &&
      b.ats_strategy &&
      b.layout_strategy,
  );
}
