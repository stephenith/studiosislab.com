/**
 * Visual hierarchy system — typography ladder, weights, and experience readability.
 * Founder Review #002: premium perception, ATS-safe, no clutter.
 */
import type { DesignMemoryContext } from "./DesignMemoryBridge.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const HIERARCHY_LADDER_RULES = {
  name_prominence_ratio_min: 3.3,
  name_weight: 800,
  title_weight: 500,
  section_weight: 700,
  contact_weight: 400,
  job_title_weight: 700,
  company_weight: 400,
  date_weight: 400,
  bullet_weight: 400,
  job_title_pt: 12,
  company_pt: 11.5,
  date_pt: 10.5,
  experience_entry_gap_px: 16,
  role_to_date_gap_px: 6,
  date_to_bullet_gap_px: 8,
  bullet_line_px: 22,
  section_separator_px: 20,
  vertical_rhythm_px: 8,
} as const;

export type HierarchyLevel = {
  level: string;
  size_pt: number;
  weight: number;
  line_height: number;
  color_role: "text" | "muted" | "subtle" | "accent";
  ats_safe: boolean;
};

export type HierarchySpec = typeof HIERARCHY_LADDER_RULES;

export function buildHierarchySystem(ctx: DesignMemoryContext) {
  const t = ctx.effective_typography;
  const h = ctx.effective_hierarchy;
  const spacing = ctx.effective_spacing;

  const ladder: HierarchyLevel[] = [
    {
      level: "name",
      size_pt: t.name_size_pt,
      weight: h.name_weight,
      line_height: t.name_line_height,
      color_role: "text",
      ats_safe: true,
    },
    {
      level: "job_title_header",
      size_pt: t.title_size_pt,
      weight: h.title_weight,
      line_height: 1.25,
      color_role: "muted",
      ats_safe: true,
    },
    {
      level: "contact",
      size_pt: t.contact_size_pt,
      weight: h.contact_weight,
      line_height: 1.3,
      color_role: "subtle",
      ats_safe: true,
    },
    {
      level: "section_heading",
      size_pt: t.section_size_pt,
      weight: h.section_weight,
      line_height: 1.2,
      color_role: "text",
      ats_safe: true,
    },
    {
      level: "experience_role",
      size_pt: h.job_title_pt,
      weight: h.job_title_weight,
      line_height: 1.3,
      color_role: "text",
      ats_safe: true,
    },
    {
      level: "experience_date",
      size_pt: h.date_pt,
      weight: h.date_weight,
      line_height: 1.25,
      color_role: "subtle",
      ats_safe: true,
    },
    {
      level: "body_bullet",
      size_pt: t.body_size_pt,
      weight: h.bullet_weight,
      line_height: t.body_line_height,
      color_role: "text",
      ats_safe: true,
    },
  ];

  return {
    version: DESIGN_SYSTEM_VERSION,
    ladder,
    spec: h,
    ratios: {
      name_to_body: Math.round((t.name_size_pt / t.body_size_pt) * 10) / 10,
      section_to_body: Math.round((t.section_size_pt / t.body_size_pt) * 10) / 10,
      title_to_name: Math.round((t.title_size_pt / t.name_size_pt) * 100) / 100,
    },
    spacing: {
      section_gap_px: spacing.section_gap_px,
      heading_body_gap_px: spacing.heading_body_gap_px,
      paragraph_gap_px: spacing.paragraph_gap_px,
      experience_entry_gap_px: h.experience_entry_gap_px,
      vertical_rhythm_px: h.vertical_rhythm_px,
    },
    rules: [
      `Name prominence ratio ≥ ${h.name_prominence_ratio_min}:1 vs body`,
      "Clear step-down: name → title → contact → section → role → date → bullet",
      "Section headings visually distinct from body (size + weight + spacing)",
      "Experience entries: role bold, dates muted, bullets readable",
      "Whitespace on 8px vertical rhythm grid",
      "Premium perception without decorative clutter",
      "Print-safe colors and ATS linear order preserved",
    ],
    generated_at: new Date().toISOString(),
  };
}
