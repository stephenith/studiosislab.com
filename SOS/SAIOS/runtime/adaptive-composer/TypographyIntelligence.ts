/**
 * Typography intelligence — consumes Resume Design System tokens.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { CompositionMode, TypographyStrategy } from "./types.js";
import type { ComponentVariant } from "./types.js";

export function buildTypographyStrategy(input: {
  mode: CompositionMode;
  header_variant: ComponentVariant;
  seed: number;
  learning_body_pt: number;
}): TypographyStrategy {
  const system = buildDesignSystemBundle(true);
  const display = system.typography.roles.find((r) => r.role === "display")!;
  const heading = system.typography.roles.find((r) => r.role === "heading")!;
  const section = system.typography.roles.find((r) => r.role === "section")!;
  const body = system.typography.roles.find((r) => r.role === "body")!;
  const hierarchy = system.hierarchy;

  const fonts = system.typography.font_families;
  const primary = fonts.visual_approved[input.seed % fonts.visual_approved.length] ?? fonts.ats_safe[0]!;
  const secondary = fonts.ats_safe[(input.seed + 1) % fonts.ats_safe.length]!;

  const body_pt = Math.max(input.learning_body_pt || body.size_pt, body.size_pt);
  const name_pt =
    input.mode === "executive"
      ? display.size_pt
      : input.mode === "student"
        ? heading.size_pt
        : display.size_pt;
  const title_pt = heading.size_pt;
  const section_pt = section.size_pt;
  const line_height = body.line_height;

  return {
    primary_font: primary,
    secondary_font: secondary,
    header_weight: hierarchy.spec.name_weight,
    body_weight: hierarchy.spec.bullet_weight,
    name_size_pt: Math.round(name_pt),
    title_size_pt: Math.round(title_pt),
    section_header_pt: section_pt,
    body_size_pt: body_pt,
    line_height,
    letter_spacing: section.letter_spacing,
    header_scale_ratio: Math.round((name_pt / body_pt) * 10) / 10,
    justification: [
      `Fonts from design-system font_families: ${primary} + ${secondary}`,
      `Name ${name_pt}pt / body ${body_pt}pt from design-system typography roles`,
      `StudiosisLab signature ${system.visual_language.signature.id} — role/company split focal experience`,
      `Experience focal marker ${system.visual_language.experience.marker_width_px}px from visual language`,
      `Name prominence ratio ${hierarchy.ratios.name_to_body}:1 from design-system`,
    ],
  };
}
