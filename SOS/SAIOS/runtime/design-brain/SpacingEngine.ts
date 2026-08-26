/**
 * Spacing engine — section gaps, margins, density.
 * Consumes Resume Design System as single source of truth.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import type { BrainMemoryStore } from "./DesignMemory.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";
import type { SpacingSystem } from "./types.js";

export function resolveSpacing(
  style: IndustryStyleDecision,
  memory: BrainMemoryStore,
): SpacingSystem {
  const designMemory = loadDesignMemory();
  const system = buildDesignSystemBundle(true);

  const margin_px = Math.max(
    designMemory.preferred_spacing.margin_px,
    system.spacing.margin_px,
  );
  let density: SpacingSystem["density"] =
    designMemory.preferred_visual_density === "spacious"
      ? "spacious"
      : designMemory.preferred_visual_density === "compact"
        ? "compact"
        : "balanced";

  if (style.premium_feel) density = "balanced";
  if (style.ats_mode === "ats_first" && !style.premium_feel) density = "balanced";
  if (style.visual_style === "minimal") density = "compact";

  const section_gap = Math.max(
    designMemory.preferred_spacing.min_section_gap_px,
    system.spacing.section_spacing_px,
  );
  const paragraph_gap = Math.max(
    designMemory.preferred_spacing.min_paragraph_gap_px,
    system.spacing.paragraph_spacing_px,
  );

  return {
    section_gap_px: section_gap,
    paragraph_gap_px: paragraph_gap,
    margin_px,
    header_zone_pct: style.premium_feel ? 22 : 18,
    density,
  };
}
