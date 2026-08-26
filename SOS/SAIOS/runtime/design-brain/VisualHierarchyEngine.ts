/**
 * Visual hierarchy engine — weight distribution across resume zones.
 * Consumes Resume Design System hierarchy ladder.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { ComponentEmphasis, VisualHierarchy } from "./types.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";

export function resolveVisualHierarchy(style: IndustryStyleDecision): {
  hierarchy: VisualHierarchy;
  emphasis: ComponentEmphasis;
} {
  const system = buildDesignSystemBundle(true);
  const ratios = system.hierarchy.ratios;

  const hierarchy: VisualHierarchy = {
    name_weight: 100,
    title_weight: style.premium_feel ? 75 : 65,
    section_weight: Math.round(ratios.section_to_body * 25),
    body_weight: 55,
    emphasis_zones: ["name_block", "experience", "summary"],
    reading_order: [
      "name",
      "title",
      "contact",
      "summary",
      "experience",
      "education",
      "skills",
      "certifications",
    ],
  };

  const emphasis: ComponentEmphasis = {
    header: style.premium_feel ? 95 : 85,
    summary: style.industry === "executive" ? 90 : 75,
    experience: 100,
    education: style.industry === "student" || style.industry === "academic" ? 90 : 70,
    skills: style.ats_mode === "ats_first" ? 80 : 65,
    decorations: Math.round(style.decoration_budget * 100),
  };

  return { hierarchy, emphasis };
}
