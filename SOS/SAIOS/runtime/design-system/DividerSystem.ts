/**
 * Divider system — horizontal and vertical separators.
 */
import type { ATSComponentFlags } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type DividerSpec = {
  id: string;
  type: "horizontal" | "vertical";
  thickness_px: number;
  spacing_px: { before: number; after: number };
  style: "solid" | "dashed" | "spacing-only";
} & ATSComponentFlags;

const DIVIDERS: DividerSpec[] = [
  {
    id: "section-rule",
    type: "horizontal",
    thickness_px: 1,
    spacing_px: { before: 12, after: 8 },
    style: "solid",
    ats_safe: true,
    machine_readable: true,
    text_order: "heading above divider, content below",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "header-rule",
    type: "horizontal",
    thickness_px: 2,
    spacing_px: { before: 4, after: 16 },
    style: "solid",
    ats_safe: true,
    machine_readable: true,
    text_order: "header content above rule",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "sidebar-vertical",
    type: "vertical",
    thickness_px: 1,
    spacing_px: { before: 0, after: 0 },
    style: "solid",
    ats_safe: false,
    machine_readable: false,
    text_order: "decorative only",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "spacing-divider",
    type: "horizontal",
    thickness_px: 0,
    spacing_px: { before: 16, after: 16 },
    style: "spacing-only",
    ats_safe: true,
    machine_readable: true,
    text_order: "whitespace separation only",
    contrast_safe: true,
    print_safe: true,
  },
];

export function buildDividerSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    dividers: DIVIDERS,
    generated_at: new Date().toISOString(),
  };
}
