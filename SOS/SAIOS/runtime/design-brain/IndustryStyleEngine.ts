/**
 * Industry style engine — maps industry to visual posture and ATS sensitivity.
 */
import { analyzeIndustry } from "../research/IndustryAnalyzer.js";
import type { IndustryId } from "../research/types.js";
import type { AtsMode, DesignLanguage, VisualStyle } from "./types.js";

export type IndustryStyleDecision = {
  industry: IndustryId;
  visual_style: VisualStyle;
  design_language: DesignLanguage;
  ats_mode: AtsMode;
  premium_feel: boolean;
  conservative: boolean;
  decoration_budget: number;
  reasoning: string[];
};

const LANGUAGE_MAP: Record<IndustryId, DesignLanguage> = {
  software: "technical-precise",
  finance: "executive-refined",
  marketing: "creative-expressive",
  sales: "corporate-modern",
  healthcare: "healthcare-clinical",
  engineering: "technical-precise",
  construction: "corporate-modern",
  government: "conservative" as DesignLanguage,
  legal: "executive-refined",
  hr: "corporate-modern",
  operations: "corporate-modern",
  hospitality: "creative-expressive",
  education: "corporate-modern",
  creative: "creative-expressive",
  academic: "executive-refined",
  student: "minimal-ats",
  executive: "executive-refined",
};

export function resolveIndustryStyle(
  objective: string,
  industryOverride?: IndustryId,
): IndustryStyleDecision {
  const analysis = analyzeIndustry(objective);
  const industry = industryOverride ?? analysis.industry;

  let design_language = LANGUAGE_MAP[industry] ?? "corporate-modern";
  if (design_language === ("conservative" as DesignLanguage)) {
    design_language = "executive-refined";
  }

  const premium_feel =
    industry === "executive" ||
    industry === "finance" ||
    industry === "legal" ||
    objective.toLowerCase().includes("premium");

  const conservative =
    industry === "government" ||
    industry === "legal" ||
    industry === "finance" ||
    analysis.ats_sensitivity === "high";

  let visual_style: VisualStyle = "professional";
  if (premium_feel) visual_style = "premium";
  else if (conservative) visual_style = "conservative";
  else if (analysis.visual_preference === "visual_first") visual_style = "modern";
  else if (objective.toLowerCase().includes("minimal")) visual_style = "minimal";

  let ats_mode: AtsMode = "ats_first";
  if (analysis.visual_preference === "visual_first") ats_mode = "visual_first";
  else if (analysis.visual_preference === "hybrid") ats_mode = "hybrid";
  else if (analysis.visual_preference === "balanced") ats_mode = "balanced";

  const decoration_budget =
    ats_mode === "ats_first" ? 0.12 : ats_mode === "hybrid" ? 0.18 : 0.25;

  return {
    industry,
    visual_style,
    design_language,
    ats_mode,
    premium_feel,
    conservative,
    decoration_budget,
    reasoning: [
      `Industry: ${industry} — ${analysis.hiring_style}`,
      `ATS sensitivity: ${analysis.ats_sensitivity}`,
      `Visual preference: ${analysis.visual_preference}`,
      premium_feel ? "Premium feel requested or implied" : "Standard professional tone",
    ],
  };
}
