/**
 * Normalize Brain/OpenAI planning → DesignBrief BrainPlanningOutput.
 * Agent #237 — Design Family selected BEFORE role adaptation.
 */
import type { BrainPlanningOutput } from "./types.js";
import {
  resolveDesignFamily,
  type ResolvedDesignFamily,
} from "../design-families/DesignFamilyEngine.js";

export type DesignVariantId = 0 | 1 | 2 | 3 | 4;

export type VisualProfile = {
  variant: number;
  label: string;
  heading_family: string;
  body_family: string;
  scale: [number, number, number, number];
  density: "compact" | "balanced" | "spacious";
  section_gap_px: number;
  item_gap_px: number;
  paragraph_gap_px: number;
  margins_mm: { top: number; right: number; bottom: number; left: number };
  palette_id: string;
  rule_style: "short" | "full" | "double";
  name_weight: 600 | 700;
  content_profile: string;
  layout_family?: string;
  role_family?: string;
  header_style?: string;
  page_fill_target?: number;
  design_personality?: string[];
  layout_intent?: string;
  design_family?: ResolvedDesignFamily;
};

function densityMap(
  d: "compact" | "standard" | "airy",
): "compact" | "balanced" | "spacious" {
  if (d === "compact") return "compact";
  if (d === "airy") return "spacious";
  return "balanced";
}

function ruleFromFamily(
  d: ResolvedDesignFamily,
): "short" | "full" | "double" {
  if (d.divider_strategy === "full") return "full";
  if (d.divider_strategy === "double") return "double";
  if (d.divider_strategy === "short") return "short";
  return "short";
}

function sectionOrderForFamily(family: ResolvedDesignFamily): string[] {
  if (family.layout_architecture === "narrow_ats_sidebar") {
    return [
      "header",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "languages",
    ];
  }
  if (family.layout_architecture === "technical_grid") {
    return [
      "header",
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
      "languages",
    ];
  }
  if (
    family.layout_architecture === "editorial_offset" ||
    family.family_id === "creative"
  ) {
    return [
      "header",
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "languages",
    ];
  }
  return [
    "header",
    "summary",
    "experience",
    "education",
    "skills",
    "certifications",
    "languages",
  ];
}

function familyToProfile(family: ResolvedDesignFamily): VisualProfile {
  const m = family.spacing.page_margin_mm;
  return {
    variant: family.variant,
    label: `${family.family_id}__${family.layout_architecture}`,
    heading_family: family.typography_scale.heading_family,
    body_family: family.typography_scale.body_family,
    scale: [
      family.typography_scale.name_pt,
      family.typography_scale.heading_pt,
      family.typography_scale.body_pt,
      family.typography_scale.meta_pt,
    ],
    density: densityMap(family.spacing.density),
    section_gap_px: family.spacing.section_before_gap_px,
    item_gap_px: family.spacing.subsection_gap_px,
    paragraph_gap_px: family.spacing.section_after_heading_gap_px,
    margins_mm: { top: m, right: m, bottom: m, left: m },
    palette_id: `family-${family.family_id}`,
    rule_style: ruleFromFamily(family),
    name_weight: family.typography_scale.name_weight,
    content_profile: `${family.role_family}_${family.family_id}`,
    layout_family: family.layout_architecture,
    role_family: family.role_family,
    header_style: family.header_system,
    page_fill_target: family.page_fill_target,
    design_personality: family.design_personality,
    layout_intent: `${family.family_id} / ${family.layout_architecture} / ${family.silhouette_hint}`,
    design_family: family,
  };
}

/** Compatibility export for #235 scripts */
export const VISUAL_PROFILES: Record<0 | 1 | 2 | 3 | 4, VisualProfile> = {
  0: familyToProfile(
    resolveDesignFamily({ family_id: "executive", design_variant: 0 }),
  ),
  1: familyToProfile(
    resolveDesignFamily({ family_id: "modern", design_variant: 0 }),
  ),
  2: familyToProfile(
    resolveDesignFamily({ family_id: "corporate", design_variant: 0 }),
  ),
  3: familyToProfile(
    resolveDesignFamily({ family_id: "editorial", design_variant: 0 }),
  ),
  4: familyToProfile(
    resolveDesignFamily({
      family_id: "professional_sidebar",
      design_variant: 0,
    }),
  ),
};

export function getVisualProfile(output: BrainPlanningOutput): VisualProfile {
  const family = resolveDesignFamily({
    family_id: String(output.design_family ?? output.family_id ?? ""),
    design_variant: Number(output.design_variant ?? 0),
    role_family: String(output.role_family ?? ""),
    seed: [
      String(output.objective ?? ""),
      ...(Array.isArray(output.notes) ? output.notes.map(String) : []),
    ].join(" "),
  });
  return familyToProfile(family);
}

export function normalizeBrainPlanningOutput(
  raw: BrainPlanningOutput,
  opts?: {
    seed?: string | null;
    design_variant?: number;
    role_family?: string;
    design_family?: string;
  },
): BrainPlanningOutput {
  const seed = [
    opts?.seed ?? "",
    opts?.design_family ?? "",
    String((raw as { objective?: unknown }).objective ?? ""),
    ...(Array.isArray(raw.notes) ? raw.notes.map(String) : []),
  ].join(" ");

  // 1) Select design family BEFORE role adaptation
  const family = resolveDesignFamily({
    family_id:
      opts?.design_family ??
      String((raw as { design_family?: unknown }).design_family ?? ""),
    design_variant: opts?.design_variant ?? Number(raw.design_variant ?? 0),
    role_family:
      opts?.role_family ?? String((raw as { role_family?: unknown }).role_family ?? ""),
    seed,
  });
  const profile = familyToProfile(family);
  const sectionOrder = sectionOrderForFamily(family);
  const m = family.spacing.page_margin_mm;

  const notes = [
    ...(Array.isArray(raw.notes) ? raw.notes.map(String) : []),
    `design_family:${family.family_id}`,
    `design_variant:${family.variant}`,
    `layout_architecture:${family.layout_architecture}`,
    `header_system:${family.header_system}`,
    `section_title_system:${family.section_title_system}`,
    `role_family:${family.role_family}`,
    `design_family_engine:v1`,
  ];

  return {
    ...raw,
    design_family: family.family_id,
    design_family_contract: family,
    design_variant: family.variant,
    visual_profile: profile.label,
    role_family: family.role_family,
    layout_family: family.layout_architecture,
    layout_architecture: family.layout_architecture,
    header_style: family.header_system,
    header_system: family.header_system,
    section_title_system: family.section_title_system,
    alignment_system: family.alignment_system,
    page_fill_target: family.page_fill_target,
    design_personality: family.design_personality,
    layout_intent: profile.layout_intent,
    plan_type: String(raw.plan_type ?? raw.capability ?? "resume_design"),
    capability: String(raw.capability ?? "design_planning"),
    sections: sectionOrder,
    layout: {
      columns: family.sidebar_policy === "narrow_ats_safe" ? 1 : 1,
      page_size: "A4",
      margins_mm: { top: m, right: m, bottom: m, left: m },
    },
    typography: {
      heading: family.typography_scale.heading_family,
      body: family.typography_scale.body_family,
      scale: [
        family.typography_scale.name_pt,
        family.typography_scale.heading_pt,
        family.typography_scale.body_pt,
        family.typography_scale.meta_pt,
      ],
    },
    spacing_density: profile.density,
    section_gap_px: family.spacing.section_before_gap_px,
    item_gap_px: family.spacing.subsection_gap_px,
    paragraph_gap_px: family.spacing.section_after_heading_gap_px,
    palette_id: `family-${family.family_id}`,
    family_colors: family.color_strategy,
    rule_style: profile.rule_style,
    name_weight: family.typography_scale.name_weight,
    content_profile: profile.content_profile,
    heading_scale_pt: family.typography_scale.heading_pt,
    body_size_pt: family.typography_scale.body_pt,
    spacing_tokens: family.spacing,
    sidebar_policy: family.sidebar_policy,
    accent_shape_strategy: family.accent_shape_strategy,
    ats_risk_level: family.ats_risk_level,
    notes,
  };
}
