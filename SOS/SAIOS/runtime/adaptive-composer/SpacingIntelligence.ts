/**
 * Spacing intelligence — consumes Resume Design System tokens.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { CompositionMode, SpacingStrategy } from "./types.js";
import type { ComposerKnowledgeContext } from "./KnowledgeConsumer.js";
import type { ComponentVariant } from "./types.js";

export function buildSpacingStrategy(input: {
  mode: CompositionMode;
  knowledge: ComposerKnowledgeContext;
  header_variant: ComponentVariant;
  seed: number;
}): SpacingStrategy {
  const system = buildDesignSystemBundle(true);
  const scale = system.spacing.scale;
  const baseMargin = system.page_width.margins.left_px;
  const sectionRhythm = system.section_rhythm.transitions;
  const focal = system.visual_language.focal_weights;
  const modeMultiplier =
    input.mode === "executive" ? 1.1 : input.mode === "student" ? 0.95 : input.mode === "ats" ? 1.0 : 1.05;
  const seedOffset = scale[input.seed % scale.length]! % 8;
  const rhythmOffset = (input.seed % 3) * 2;

  const margin_left = Math.round(baseMargin + seedOffset);
  const margin_right = margin_left;
  const section_spacing = Math.round(system.spacing.section_spacing_px * modeMultiplier) + rhythmOffset;
  const vertical_rhythm = system.hierarchy.spec.vertical_rhythm_px;

  const distribution: SpacingStrategy["whitespace_distribution"] =
    input.mode === "executive" || input.header_variant === "luxury"
      ? "generous"
      : input.mode === "ats"
        ? "compact"
        : "balanced";

  const line_spacing = system.typography.roles.find((r) => r.role === "body")?.line_height ?? 1.35;

  return {
    vertical_rhythm_px: vertical_rhythm,
    section_spacing_px: section_spacing,
    paragraph_spacing_px: system.spacing.paragraph_spacing_px,
    line_spacing,
    margin_top_px: system.margins.default.margin_top,
    margin_bottom_px: system.margins.default.margin_bottom,
    margin_left_px: margin_left,
    margin_right_px: margin_right,
    padding_section_px: system.spacing.heading_body_gap_px,
    whitespace_distribution: distribution,
    justification: [
      `Vertical rhythm ${vertical_rhythm}px from Design System baseline`,
      `Section spacing ${section_spacing}px from design-system tokens`,
      `Focal weights: header ${focal.header} → experience ${focal.experience} → summary ${focal.summary}`,
      `Margins ${margin_left}px from design-system page_width tokens`,
      `Line spacing ${line_spacing} from design-system typography roles`,
    ],
  };
}
