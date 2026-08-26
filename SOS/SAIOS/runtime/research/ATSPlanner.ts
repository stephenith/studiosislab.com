/**
 * ATS planner — parse reliability, forbidden elements, keyword strategy.
 */
import type { ATSPlan, IndustryAnalysis, LayoutPlan } from "./types.js";

export function planATS(input: {
  industry: IndustryAnalysis;
  layout: LayoutPlan;
  objective: string;
}): ATSPlan {
  const atsFirst =
    input.industry.ats_sensitivity === "high" ||
    input.objective.toLowerCase().includes("ats");

  const tier: ATSPlan["compatibility_tier"] = atsFirst
    ? "ats_safe"
    : input.industry.visual_preference === "visual_first"
      ? "visual"
      : "hybrid";

  return {
    compatibility_tier: tier,
    section_order: input.layout.section_order,
    keyword_strategy: [
      "Mirror standard section headings (Experience, Education, Skills)",
      "Include industry-relevant keywords in experience bullets",
      "Avoid graphics for skill representation in ATS tier",
      `Target industry: ${input.industry.industry}`,
    ],
    heading_structure: [
      "H1 equivalent: candidate name (Textbox, largest size)",
      "Section headings: uppercase or bold, consistent style",
      "Job titles bold; employers regular weight",
    ],
    text_hierarchy_rules: [
      "All content as Textbox objects",
      "No text in images",
      "Minimum 10.5pt body",
      "Left-aligned body text for ATS parse",
    ],
    forbidden_elements:
      tier === "ats_safe"
        ? [
            "Skill bars",
            "Star ratings",
            "Tables for layout",
            "Icons as content",
            "Multi-column text boxes",
            "Images in content area",
          ]
        : ["Skill bars in primary content", "Unreadable decorative fonts"],
    tables_allowed: tier !== "ats_safe",
    images_allowed: tier === "visual",
    icons_allowed: tier === "visual",
    widgets_allowed: false,
    parse_reliability_score: tier === "ats_safe" ? 95 : tier === "hybrid" ? 82 : 70,
  };
}
