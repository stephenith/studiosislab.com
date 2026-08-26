/**
 * Responsive rules — print and viewport considerations.
 */
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export function buildResponsiveRules() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    print: {
      page_size: "A4",
      dpi: 96,
      color_profile: "sRGB",
      bleed_px: 0,
      safe_zone_px: 40,
    },
    viewport: {
      design_width_px: 794,
      design_height_px: 1123,
      scale_for_preview: true,
    },
    rules: [
      "Design at fixed A4 canvas — no fluid breakpoints",
      "Print preview must match Fabric canvas at 100%",
      "No responsive reflow — single page layout discipline",
      "Thumbnail generation uses separate specification",
    ],
    generated_at: new Date().toISOString(),
  };
}
