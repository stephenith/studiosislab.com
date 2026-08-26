/**
 * Typography planner — derive typography plan from industry + intelligence + comparison.
 */
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import type { IndustryAnalysis, TemplateComparison, TypographyPlan } from "./types.js";

export function planTypography(input: {
  industry: IndustryAnalysis;
  comparison: TemplateComparison;
  objective: string;
}): TypographyPlan {
  const memory = safeLoadMemory();
  const atsFirst =
    input.industry.ats_sensitivity === "high" ||
    input.objective.toLowerCase().includes("ats");

  const font_family = atsFirst
    ? memory.preferred_typography.font_families[0] ?? "Inter"
    : memory.preferred_typography.font_families[1] ?? "Inter";

  const bodySize = Math.max(memory.preferred_typography.min_body_pt, 10.5);
  const scale = memory.preferred_typography.heading_scale;

  return {
    font_family,
    heading_hierarchy: [
      { level: "name", size_pt: Math.round(bodySize * scale * 1.4), weight: "bold" },
      { level: "title", size_pt: Math.round(bodySize * 1.15), weight: "medium" },
      { level: "section", size_pt: Math.round(bodySize * 1.0), weight: "bold" },
    ],
    body_hierarchy: {
      size_pt: bodySize,
      line_height: 1.35,
      weight: "regular",
    },
    spacing: {
      section_gap_px: memory.preferred_spacing.min_section_gap_px,
      paragraph_gap_px: memory.preferred_spacing.min_paragraph_gap_px,
    },
    character_spacing: {
      headings: atsFirst ? 80 : 40,
      body: 0,
    },
    visual_density: memory.preferred_visual_density,
    readability_score: atsFirst ? 92 : 85,
    accessibility_notes: [
      "Minimum 10.5pt body for ATS parse reliability",
      "Maximum 2 font families",
      "Sufficient contrast between headings and body",
      input.comparison.weaknesses_to_avoid.includes("dense text blocks")
        ? "Avoid dense text blocks identified in similar templates"
        : "Maintain balanced whitespace between sections",
    ],
  };
}

function safeLoadMemory() {
  try {
    return loadDesignMemory();
  } catch {
    return {
      preferred_typography: { font_families: ["Inter", "Arial"], min_body_pt: 10.5, heading_scale: 1.8 },
      preferred_spacing: { min_section_gap_px: 16, min_paragraph_gap_px: 6, margin_px: 48 },
      preferred_visual_density: "balanced" as const,
    };
  }
}
