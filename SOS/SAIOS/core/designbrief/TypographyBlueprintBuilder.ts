/**
 * Typography blueprint — deterministic ATS-safe mapping from planning + DNA profiles.
 */
import type { BrainPlanningOutput, TypographyBlueprint } from "./types.js";

/** ATS-safe font allowlist (resume construction, not marketing UI). */
const ATS_FONTS = new Set([
  "Inter",
  "Arial",
  "Helvetica",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Roboto",
  "Source Sans 3",
  "IBM Plex Sans",
]);

function normalizeFont(raw: string | undefined, fallback: string): string {
  const name = (raw ?? fallback).trim() || fallback;
  return ATS_FONTS.has(name) ? name : "Inter";
}

function parseScale(scale: Array<string | number> | undefined): {
  name: number;
  heading: number;
  body: number;
  meta: number;
} {
  const nums = (scale ?? []).map((x) => Number(x)).filter((n) => n > 0);
  // Prefer 4-part scale: name, heading, body, meta (Agent #235)
  if (nums.length >= 4) {
    return {
      name: nums[0],
      heading: nums[1],
      body: nums[2],
      meta: nums[3],
    };
  }
  // Legacy 3-part: name, body, meta — derive heading
  if (nums.length >= 3) {
    const name = nums[0];
    const body = nums[1];
    const meta = nums[2];
    return {
      name,
      heading: Math.max(meta + 1, Math.round(body * 0.95) + 2),
      body,
      meta,
    };
  }
  // Premium default (was weak Inter 24/15/14 Word-doc look)
  return { name: 34, heading: 12, body: 11, meta: 10 };
}

export function buildTypographyBlueprint(
  output: BrainPlanningOutput,
): TypographyBlueprint {
  const heading_family = normalizeFont(output.typography?.heading, "Inter");
  const body_family = normalizeFont(output.typography?.body, heading_family);
  const scale_pt = parseScale(output.typography?.scale);
  if (typeof output.heading_scale_pt === "number" && output.heading_scale_pt > 0) {
    scale_pt.heading = Number(output.heading_scale_pt);
  }
  if (typeof output.body_size_pt === "number" && output.body_size_pt > 0) {
    scale_pt.body = Number(output.body_size_pt);
  }
  const nameWeight =
    Number(output.name_weight) === 700 || Number(output.name_weight) === 600
      ? Number(output.name_weight)
      : 700;

  return {
    heading_family,
    body_family,
    scale_pt,
    line_height: {
      heading: 1.2,
      body: scale_pt.body <= 10.5 ? 1.45 : 1.4,
    },
    weights: { name: nameWeight, heading: 600, body: 400 },
    ats_safe_fonts_only: true,
  };
}
