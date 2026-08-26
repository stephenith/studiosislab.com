/**
 * Layout planner — structure, margins, section order, reading flow.
 */
import type { IndustryAnalysis, LayoutPlan, TemplateComparison } from "./types.js";

export function planLayout(input: {
  industry: IndustryAnalysis;
  comparison: TemplateComparison;
  objective: string;
}): LayoutPlan {
  const lower = input.objective.toLowerCase();
  let structure: LayoutPlan["structure"] = "single_column";

  if (input.industry.visual_preference === "visual_first") structure = "modern";
  else if (input.industry.industry === "executive") structure = "executive";
  else if (lower.includes("sidebar")) structure = "sidebar";
  else if (lower.includes("minimal")) structure = "minimal";
  else if (lower.includes("compact")) structure = "compact";
  else if (input.industry.ats_sensitivity === "high") structure = "ats_first";
  else if (input.industry.visual_preference === "hybrid") structure = "hybrid";

  const margin = input.industry.ats_sensitivity === "high" ? 56 : 48;

  const section_order = defaultSectionOrder(input.industry.industry);

  return {
    structure,
    margins_px: { top: margin, right: margin, bottom: margin, left: margin },
    whitespace_strategy:
      "Balanced whitespace with 8px grid alignment; avoid overlap with similar template weaknesses",
    section_order,
    reading_flow: "Top-to-bottom, left-to-right within sections; name → contact → summary → experience → education → skills",
    column_structure:
      structure === "sidebar" || structure === "dual_column"
        ? "sidebar-left"
        : "single",
  };
}

function defaultSectionOrder(industry: string): string[] {
  const base = ["summary", "experience", "education", "skills"];
  if (industry === "academic" || industry === "education") {
    return ["summary", "education", "experience", "publications", "skills"];
  }
  if (industry === "healthcare") {
    return ["summary", "licenses", "experience", "education", "skills"];
  }
  if (industry === "executive") {
    return ["summary", "experience", "leadership", "education", "skills"];
  }
  return [...base, "certifications"];
}
