/**
 * Page width optimization — printable margins and usable text column.
 * Founder Review #003.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const PAGE_WIDTH_RULES = {
  canvas_width_px: 794,
  canvas_height_px: 1123,
  margin_px: 44,
  print_safe_zone_px: 40,
  content_utilization_target: 0.88,
} as const;

export type PageWidthSpec = typeof PAGE_WIDTH_RULES;

export function buildPageWidthSystem(ctx: DesignMemoryContext) {
  const p = ctx.effective_page_width;

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: p,
    canvas: {
      width_px: p.canvas_width_px,
      height_px: p.canvas_height_px,
    },
    margins: {
      left_px: p.margin_px,
      right_px: p.margin_px,
      print_safe_zone_px: p.print_safe_zone_px,
    },
    content_width_px: p.content_width_px,
    content_utilization_target: p.content_utilization_target,
    rules: [
      `Optimized margins ${p.margin_px}px — wider text column, print-safe ≥ ${p.print_safe_zone_px}px`,
      "Content width derived from canvas minus margins — never hardcoded in builder",
      "Fuller page presence without stretching typography",
    ],
    generated_at: new Date().toISOString(),
  };
}
