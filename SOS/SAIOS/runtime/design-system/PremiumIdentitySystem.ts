/**
 * Premium visual identity — ATS-safe section markers and divider treatment.
 * Founder Review #003.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const PREMIUM_IDENTITY_RULES = {
  section_marker_width_px: 48,
  section_marker_height_px: 3,
  section_rule_width_pct: 1.0,
  section_rule_thickness_px: 1,
  section_rule_gap_below_heading_px: 6,
  section_rule_gap_above_content_px: 10,
  divider_color_role: "divider" as const,
  accent_marker: true,
  header_identity: "accent-bar-plus-rule",
} as const;

export type PremiumIdentitySpec = typeof PREMIUM_IDENTITY_RULES;

export function buildPremiumIdentitySystem(ctx: DesignMemoryContext) {
  const id = ctx.effective_premium_identity;
  const content_w = ctx.effective_page_width.content_width_px;

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: id,
    section_marker: {
      width_px: id.section_marker_width_px,
      height_px: id.section_marker_height_px,
      position: "below_heading" as const,
    },
    section_rule: {
      width_px: Math.round(content_w * id.section_rule_width_pct),
      thickness_px: id.section_rule_thickness_px,
      gap_below_heading_px: id.section_rule_gap_below_heading_px,
      gap_above_content_px: id.section_rule_gap_above_content_px,
    },
    identity_signature: id.header_identity,
    rules: [
      "Accent marker below section headings — recognizable template identity",
      "Full-width subtle rule separates heading from body",
      "No icons, photos, columns, tables, or background shapes",
      "Decorative elements excluded from ATS text extraction",
      "Print-safe 1px rules at #e5e7eb or accent",
    ],
    generated_at: new Date().toISOString(),
  };
}
