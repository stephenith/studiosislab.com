/**
 * Typography engine — font hierarchy and readability decisions.
 * Consumes Resume Design System as single source of truth.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import { loadDesignMemory } from "../workers/resume-learning/design-memory.js";
import type { BrainMemoryStore } from "./DesignMemory.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";
import type { TypographySystem } from "./types.js";

export function resolveTypography(
  style: IndustryStyleDecision,
  memory: BrainMemoryStore,
): TypographySystem {
  const designMemory = loadDesignMemory();
  const system = buildDesignSystemBundle(true);
  const hierarchy = system.hierarchy;
  const display = system.typography.roles.find((r) => r.role === "display")!;
  const heading = system.typography.roles.find((r) => r.role === "heading")!;
  const section = system.typography.roles.find((r) => r.role === "section")!;
  const body = system.typography.roles.find((r) => r.role === "body")!;

  const preferred =
    memory.aggregate.preferred_fonts[0] ??
    designMemory.preferred_typography.font_families[0] ??
    "Inter";
  const body_size_pt = Math.max(designMemory.preferred_typography.min_body_pt, body.size_pt);

  return {
    primary_font: preferred,
    secondary_font: style.conservative ? null : "Arial",
    name_size_pt: display.size_pt,
    title_size_pt: heading.size_pt,
    section_size_pt: section.size_pt,
    body_size_pt,
    line_height: body.line_height,
    heading_char_spacing: Math.round(section.letter_spacing * 1000),
    hierarchy_levels: hierarchy.ladder.map((level) => ({
      level: level.level,
      size_pt: level.size_pt,
      weight:
        level.weight >= 700 ? "bold" : level.weight >= 500 ? "medium" : "regular",
    })),
  };
}
