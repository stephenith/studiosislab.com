/**
 * DesignBrief validation — deterministic gate before any renderer handoff.
 */
import type { DesignBrief } from "./types.js";

export function validateDesignBrief(brief: DesignBrief): {
  pass: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!brief.brief_id) errors.push("brief_id required");
  if (brief.dry_run !== true) errors.push("dry_run must be true");
  if (brief.live_enabled !== false) errors.push("live_enabled must be false");
  if (brief.publication_allowed !== false) {
    errors.push("publication_allowed must be false");
  }
  if (brief.template_generated !== false) {
    errors.push("template_generated must be false");
  }
  if (brief.source.provider !== "mock") {
    errors.push("source.provider must be mock in V1");
  }

  if (brief.layout.columns !== 1 || brief.layout.structure !== "single_column") {
    errors.push("ATS requires single_column layout");
  }
  if (brief.ats.tier !== "ats_safe") errors.push("ats.tier must be ats_safe");
  if (brief.ats.tables_allowed !== false) errors.push("tables must be forbidden");
  if (brief.ats.images_allowed !== false) errors.push("images must be forbidden");
  if (brief.ats.icons_allowed !== false) errors.push("icons must be forbidden");
  if (brief.ats.multi_column_forbidden !== true) {
    errors.push("multi_column must be forbidden");
  }

  if (!brief.typography.ats_safe_fonts_only) {
    errors.push("typography must declare ats_safe_fonts_only");
  }
  for (const key of ["name", "heading", "body", "meta"] as const) {
    if (!(brief.typography.scale_pt[key] > 0)) {
      errors.push(`typography.scale_pt.${key} invalid`);
    }
  }

  if (brief.sections.order.length === 0) errors.push("sections.order empty");
  for (const req of brief.sections.required) {
    if (!brief.sections.order.includes(req)) {
      errors.push(`required section missing from order: ${req}`);
    }
  }

  if (brief.spacing.unit_px !== 4) warnings.push("spacing.unit_px expected 4");
  if (brief.spacing.section_gap_px < 12) {
    warnings.push("section_gap_px below 12 may hurt readability");
  }

  if (!brief.colors.ats_safe || !brief.colors.contrast_ok) {
    errors.push("color palette must be ATS-safe with contrast_ok");
  }

  if (brief.components.length !== brief.sections.order.length) {
    errors.push("component map length must match section order");
  }

  const rj = brief.resume_json;
  if (rj.dry_run !== true) errors.push("resume_json.dry_run must be true");
  if (rj.publication_allowed !== false) {
    errors.push("resume_json.publication_allowed must be false");
  }
  if (rj.template_generated !== false) {
    errors.push("resume_json.template_generated must be false");
  }
  if (rj.sections.length === 0) errors.push("resume_json.sections empty");
  if (rj.objects_plan.length === 0) errors.push("resume_json.objects_plan empty");

  return { pass: errors.length === 0, errors, warnings };
}
