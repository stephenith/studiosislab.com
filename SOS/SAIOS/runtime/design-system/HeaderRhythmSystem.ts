/**
 * Header rhythm system — vertical spacing between name, title, contact, and summary.
 * Founder Review #001: no overlap, clear hierarchy, ATS-safe stacked header.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const HEADER_RHYTHM_RULES = {
  name_below_accent_gap_px: 16,
  name_to_title_gap_px: 14,
  title_to_contact_gap_px: 12,
  contact_to_summary_gap_px: 20,
  min_clearance_px: 8,
  position_using_measured_height: true,
} as const;

export type HeaderRhythmSpec = {
  name_below_accent_gap_px: number;
  name_to_title_gap_px: number;
  title_to_contact_gap_px: number;
  contact_to_summary_gap_px: number;
  min_clearance_px: number;
  position_using_measured_height: boolean;
};

export function buildHeaderRhythmSystem(ctx: DesignMemoryContext) {
  const cal = ctx.founder_calibration?.header_rhythm;
  const scale = [4, 8, 12, 16, 20, 24];

  const rhythm: HeaderRhythmSpec = {
    name_below_accent_gap_px: cal?.name_below_accent_gap_px ?? HEADER_RHYTHM_RULES.name_below_accent_gap_px,
    name_to_title_gap_px: Math.max(
      cal?.name_to_title_gap_px ?? HEADER_RHYTHM_RULES.name_to_title_gap_px,
      scale[2]!,
    ),
    title_to_contact_gap_px: Math.max(
      cal?.title_to_contact_gap_px ?? HEADER_RHYTHM_RULES.title_to_contact_gap_px,
      scale[2]!,
    ),
    contact_to_summary_gap_px: Math.max(
      cal?.contact_to_summary_gap_px ?? HEADER_RHYTHM_RULES.contact_to_summary_gap_px,
      scale[3]!,
    ),
    min_clearance_px: HEADER_RHYTHM_RULES.min_clearance_px,
    position_using_measured_height: true,
  };

  return {
    version: DESIGN_SYSTEM_VERSION,
    rhythm,
    rules: [
      "Position header lines using measured textbox height — never underestimate",
      `Minimum ${rhythm.min_clearance_px}px clearance between name, title, and contact`,
      `${rhythm.name_to_title_gap_px}px gap below candidate name`,
      `${rhythm.title_to_contact_gap_px}px gap between job title and contact line`,
      `${rhythm.contact_to_summary_gap_px}px rhythm between contact block and summary section`,
      "Preserve ATS linear text order: name → title → contact → summary",
      "Do not reduce page utilization when fixing header overlap",
    ],
    generated_at: new Date().toISOString(),
  };
}

export function resolveHeaderRhythm(ctx: DesignMemoryContext): HeaderRhythmSpec {
  return buildHeaderRhythmSystem(ctx).rhythm;
}
