import type { LayoutRule } from "./types.js";

/**
 * Layout rules for StudiosisLab resume template generation.
 */
export const LAYOUT_RULES: readonly LayoutRule[] = [
  {
    id: "single-column-primary",
    name: "Single Column Primary",
    rule: "Main content flows in one vertical column within safe margins",
    ats_risk: "low",
    studiosislab_current: "Most templates use single main column; some use header bands + side accents",
    target_standard: "ATS tier: strict single column; Visual tier: accent sidebar allowed if copy-paste order verified",
  },
  {
    id: "safe-margins",
    name: "Safe Margins",
    rule: "Minimum 40px (≈0.5in) content inset on all sides",
    ats_risk: "low",
    studiosislab_current: "Corpus shows min left values from -257px to 85px — inconsistent",
    target_standard: "Enforce safe area 40–72px; full-bleed only on locked background rects",
  },
  {
    id: "no-negative-positioning",
    name: "No Negative Positioning",
    rule: "Selectable content objects must have left ≥ 0 and top ≥ 0",
    ats_risk: "high",
    studiosislab_current: "92 objects with negative coordinates across corpus",
    target_standard: "Zero negative coords on text/content layers in new templates",
  },
  {
    id: "header-band",
    name: "Header Band",
    rule: "Name and contact grouped in top 15–25% of page",
    ats_risk: "medium",
    studiosislab_current: "Common pattern: colored rect header with centered name",
    target_standard: "Header text remains plain Textbox; colored rect behind, not containing images of text",
  },
  {
    id: "section-dividers",
    name: "Section Dividers",
    rule: "Horizontal lines or spacing separate sections",
    ats_risk: "low",
    studiosislab_current: "252 Line objects used as dividers",
    target_standard: "Lines decorative only; section title always in Textbox above content",
  },
  {
    id: "two-column-rows",
    name: "Experience Row Layout",
    rule: "Job title left, dates right on same row — not full page columns",
    ats_risk: "medium",
    studiosislab_current: "Used in manager and IT templates",
    target_standard: "Allowed when reading order is title → company → bullets → dates as plain text",
  },
  {
    id: "image-placement",
    name: "Image Placement",
    rule: "Photos and icons optional in visual tier only",
    ats_risk: "high",
    studiosislab_current: "55 image objects; 1 template tagged with image",
    target_standard: "ATS tier: no photos; Visual tier: photo max 120×120 in header, never behind text",
  },
  {
    id: "group-nesting",
    name: "Group Nesting",
    rule: "Limit Fabric group depth to 2 levels",
    ats_risk: "medium",
    studiosislab_current: "151 groups — some deep nesting in creative templates",
    target_standard: "Flatten groups where possible; validate export order after ungroup",
  },
] as const;

export const LAYOUT_SAFE_AREA = {
  canvas_width: 794,
  canvas_height: 1123,
  margin_top: 48,
  margin_bottom: 48,
  margin_left: 56,
  margin_right: 56,
  content_width: 682,
  header_max_height: 240,
} as const;

export function getLayoutRuleById(id: string): LayoutRule | undefined {
  return LAYOUT_RULES.find((r) => r.id === id);
}
