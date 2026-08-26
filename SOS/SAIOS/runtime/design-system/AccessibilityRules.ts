/**
 * Accessibility rules — contrast, font sizes, color blindness.
 */
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export function buildAccessibilityRules() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    minimum_contrast_ratio: 4.5,
    large_text_contrast_ratio: 3,
    minimum_body_pt: 10,
    recommended_body_pt: 11.5,
    print_safe_colors: {
      min_body_luminance: 0.15,
      avoid_pure_yellow_on_white: true,
      avoid_light_gray_below: "#9CA3AF",
    },
    spacing_rules: [
      "Minimum 8px between interactive-adjacent text blocks",
      "Section headings must have 12px+ separation from body",
      "Line height ≥ 1.25 for body text",
    ],
    color_blindness: [
      "Do not rely on color alone for hierarchy — use weight and size",
      "Red/green accent pairs avoided in status indicators",
      "Test palettes with deuteranopia simulation",
    ],
    generated_at: new Date().toISOString(),
  };
}
