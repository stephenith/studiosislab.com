/**
 * Whitespace engine — breathing room and scan-path optimization.
 */
import type { SpacingSystem } from "./types.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";

export type WhitespaceDecision = {
  whitespace_score: number;
  header_breathing_px: number;
  section_breathing_px: number;
  bullet_indent_px: number;
  recommendations: string[];
};

export function resolveWhitespace(
  style: IndustryStyleDecision,
  spacing: SpacingSystem,
): WhitespaceDecision {
  const header_breathing = style.premium_feel ? 32 : 24;
  const section_breathing = spacing.section_gap_px;
  const bullet_indent = 16;

  const recommendations = [
    `Maintain ${spacing.margin_px}px page margins`,
    `Section gaps ≥ ${section_breathing}px`,
    style.premium_feel
      ? "Generous header zone for premium perception"
      : "Compact header for ATS-first scan efficiency",
    "Avoid sub-8px vertical collisions between text blocks",
  ];

  const whitespace_score = Math.min(
    100,
    Math.round(
      70 +
        (spacing.density === "spacious" ? 15 : spacing.density === "balanced" ? 10 : 0) +
        (style.premium_feel ? 10 : 5),
    ),
  );

  return {
    whitespace_score,
    header_breathing_px: header_breathing,
    section_breathing_px: section_breathing,
    bullet_indent_px: bullet_indent,
    recommendations,
  };
}
