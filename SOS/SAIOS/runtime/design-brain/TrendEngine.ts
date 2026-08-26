/**
 * Trend engine — synthesize validated trend principles (no layout copying).
 */
import type { ValidatedResearch } from "./ResearchIntegration.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";

export type TrendDecision = {
  trends_applied: string[];
  hiring_preferences: string[];
  ats_trends: string[];
  typography_trends: string[];
  spacing_trends: string[];
};

export function resolveTrends(
  research: ValidatedResearch,
  style: IndustryStyleDecision,
): TrendDecision {
  return {
    trends_applied: research.principles.slice(0, 6),
    hiring_preferences: [
      "Measurable achievements in experience bullets",
      "Clear section headings for ATS parse",
      style.premium_feel ? "Executive summary with leadership scope" : "Concise professional summary",
      "Skills aligned to job description keywords",
    ],
    ats_trends: style.ats_mode === "ats_first"
      ? [
          "Single column preferred",
          "No tables for layout",
          "Plain text skill lists",
          "Standard section names",
        ]
      : ["Visual tier allows accent elements with verified reading order"],
    typography_trends: [
      "Inter / Arial / Calibri dominate 2024–2026 ATS-safe resumes",
      "11pt body with 1.3–1.4 line height",
      "Uppercase section headings with modest char spacing",
    ],
    spacing_trends: [
      "48–56px margins trending for premium feel",
      "16–20px between sections",
      "Generous whitespace improves recruiter scan time",
    ],
  };
}
