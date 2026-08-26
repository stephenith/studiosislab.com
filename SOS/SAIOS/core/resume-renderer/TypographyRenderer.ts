/**
 * TypographyRenderer — resolve type tokens from Resume JSON.
 */
import type { ResolvedTypography, ResumeJsonInput } from "./types.js";

export function renderTypography(input: ResumeJsonInput): ResolvedTypography {
  const t = input.typography;
  return {
    heading_family: t.heading_family,
    body_family: t.body_family,
    scale_pt: { ...t.scale_pt },
    line_height: { ...t.line_height },
    weights: { ...t.weights },
  };
}
