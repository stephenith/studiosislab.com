/**
 * Content density rules — perceived richness without crowding.
 * Founder Review #003.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const CONTENT_DENSITY_RULES = {
  optimal_chars_per_line: 72,
  summary_line_break_target: 2,
  bullet_gap_px: 10,
  experience_entry_gap_px: 18,
  paragraph_composition_gap_px: 6,
  density_target: "balanced-rich" as const,
} as const;

export type ContentDensitySpec = typeof CONTENT_DENSITY_RULES;

export function buildContentDensitySystem(ctx: DesignMemoryContext) {
  const d = ctx.effective_content_density;
  const content_w = ctx.effective_page_width.content_width_px;
  const body_pt = ctx.effective_typography.body_size_pt;

  const chars_per_line = Math.min(
    d.optimal_chars_per_line,
    Math.floor(content_w / (body_pt * 0.48)),
  );

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: d,
    computed: {
      content_width_px: content_w,
      optimal_chars_per_line: chars_per_line,
      bullet_gap_px: d.bullet_gap_px,
      experience_entry_gap_px: d.experience_entry_gap_px,
    },
    rules: [
      "Wider content column increases perceived completeness",
      "Bullet rhythm uses measured height + density gap",
      "Experience entries separated by 18px for scanability",
      "Summary composed in 2 tight paragraphs for premium feel",
      "Density target: balanced-rich — full page without clutter",
    ],
    generated_at: new Date().toISOString(),
  };
}
