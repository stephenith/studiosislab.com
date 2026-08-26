/**
 * Premium Header System V2 — refined composition, rhythm, and first impression.
 * Founder Review #003.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const PREMIUM_HEADER_V2_RULES = {
  accent_bar_height_px: 4,
  accent_bar_width_pct: 0.18,
  accent_bar_min_width_px: 96,
  accent_bar_max_width_px: 140,
  header_rule_width_px: 120,
  header_rule_thickness_px: 2,
  header_rule_gap_below_contact_px: 12,
  contact_letter_spacing: 20,
  name_tracking: 0,
  header_zone_max_pct: 0.24,
} as const;

export type PremiumHeaderSpec = typeof PREMIUM_HEADER_V2_RULES;

export function buildPremiumHeaderSystem(ctx: DesignMemoryContext) {
  const h = ctx.effective_premium_header;
  const rhythm = ctx.effective_header_rhythm;
  const margin = ctx.effective_page_width.margin_px;
  const content_w = ctx.effective_page_width.content_width_px;

  const accent_width = Math.min(
    h.accent_bar_max_width_px,
    Math.max(h.accent_bar_min_width_px, Math.round(content_w * h.accent_bar_width_pct)),
  );

  return {
    version: DESIGN_SYSTEM_VERSION,
    spec: h,
    composition: {
      accent_bar: {
        height_px: h.accent_bar_height_px,
        width_px: accent_width,
        alignment: "left" as const,
      },
      header_rule: {
        width_px: h.header_rule_width_px,
        thickness_px: h.header_rule_thickness_px,
        gap_below_contact_px: h.header_rule_gap_below_contact_px,
      },
      rhythm: {
        name_below_accent_gap_px: rhythm.name_below_accent_gap_px,
        name_to_title_gap_px: rhythm.name_to_title_gap_px,
        title_to_contact_gap_px: rhythm.title_to_contact_gap_px,
        contact_to_summary_gap_px:
          rhythm.contact_to_summary_gap_px + h.header_rule_gap_below_contact_px,
      },
      contact: {
        letter_spacing: h.contact_letter_spacing,
      },
      margins: { left_px: margin, content_width_px: content_w },
    },
    rules: [
      "Accent bar: short left-aligned mark for visual identity (not full bleed)",
      "Header rule below contact: subtle 2px accent line before summary",
      "Measured textbox positioning preserves ATS linear order",
      "Header zone ≤ 24% of page height for balance",
      "Premium rhythm without decorative clutter",
    ],
    generated_at: new Date().toISOString(),
  };
}
