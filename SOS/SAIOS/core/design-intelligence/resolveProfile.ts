/**
 * Agent #236 — Resolve DNA/intelligence-backed visual profiles per role + layout family.
 */
import {
  DESIGN_INTELLIGENCE_PRINCIPLES,
  type LayoutFamilyId,
  type DesignIntelligencePrinciples,
} from "./principles.js";
import { resolveLayoutFamily } from "./DesignIntelligenceEngine.js";

export type IntelligenceVisualProfile = {
  variant: number;
  label: string;
  layout_family: LayoutFamilyId;
  role_family: string;
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
  header_style: string;
  page_fill_target: number;
  design_personality: string[];
  layout_intent: string;
  section_order: string[];
};

const FONT_BY_LAYOUT: Record<LayoutFamilyId, string> = {
  "classic-single": "Inter",
  "modern-editorial": "Source Sans 3",
  "dense-professional": "IBM Plex Sans",
};

const FONT_ROLE_OVERRIDE: Record<string, Partial<Record<LayoutFamilyId, string>>> = {
  graphic_designer: {
    "modern-editorial": "IBM Plex Sans",
    "classic-single": "Source Sans 3",
  },
  accountant: {
    "classic-single": "Inter",
    "dense-professional": "Roboto",
  },
  software_engineer: {
    "dense-professional": "IBM Plex Sans",
    "classic-single": "Roboto",
  },
};

export function resolveIntelligenceProfile(input: {
  role_family?: string | null;
  design_variant?: number;
  seed?: string | null;
  principles?: DesignIntelligencePrinciples;
}): IntelligenceVisualProfile {
  const principles = input.principles ?? DESIGN_INTELLIGENCE_PRINCIPLES;
  const role =
    String(input.role_family ?? "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_") || "";
  // Visual preference key may fall back for fonts/palette only — never rewrite
  // the authoritative content role_family (Phase 6A).
  const preferenceKey = principles.role_preferences[role]
    ? role
    : role.includes("engineer")
      ? "software_engineer"
      : role.includes("design")
        ? "graphic_designer"
        : role.includes("account")
          ? "accountant"
          : role.includes("hr") || role.includes("human")
            ? "hr_manager"
            : role.includes("market")
              ? "marketing_manager"
              : "marketing_manager";
  const contentRoleFamily = role || preferenceKey;

  const variant = Number.isInteger(input.design_variant)
    ? Math.abs(Number(input.design_variant)) % 3
    : pickVariantFromSeed(input.seed ?? contentRoleFamily);

  const layout_family = resolveLayoutFamily(preferenceKey, variant, principles);
  const family = principles.layout_families.find((l) => l.id === layout_family)!;
  const dens = family.density;
  const gaps = principles.spacing_scale;
  const margin = gaps.margins_mm[dens];
  const typo = principles.typography_scale;
  const header = principles.header_styles[family.header_style];

  let namePt = typo.name_pt.target;
  if (family.header_style === "oversized-name-short-rule") namePt = typo.name_pt.max;
  if (family.header_style === "compact-inline-rule") namePt = Math.max(typo.name_pt.min, typo.name_pt.target - 2);

  const headingPt = dens === "spacious" ? typo.heading_pt.target + 1 : typo.heading_pt.target;
  const bodyPt = dens === "compact" ? typo.body_pt.min : typo.body_pt.target;
  const metaPt = typo.meta_pt.target;

  const font =
    FONT_ROLE_OVERRIDE[preferenceKey]?.[layout_family] ??
    FONT_BY_LAYOUT[layout_family];

  const pref = principles.role_preferences[preferenceKey]!;
  const palette =
    pref.palette_bias[variant % pref.palette_bias.length] ?? "ats-navy-accent";

  const section_order =
    principles.section_rhythm.preferred_orders[layout_family] ??
    principles.section_rhythm.required_core;

  return {
    variant,
    label: `${contentRoleFamily}__${layout_family}`,
    layout_family,
    role_family: contentRoleFamily,
    heading_family: font,
    body_family: font,
    scale: [namePt, headingPt, bodyPt, metaPt],
    density: dens,
    section_gap_px: gaps.section_gap_px[dens],
    item_gap_px: gaps.item_gap_px[dens],
    paragraph_gap_px: gaps.paragraph_gap_px[dens],
    margins_mm: { top: margin, right: margin, bottom: margin, left: margin },
    palette_id: palette,
    rule_style: family.rule_style,
    name_weight: header.name_weight,
    content_profile: `${contentRoleFamily}_${layout_family}`,
    header_style: family.header_style,
    page_fill_target: principles.page_fill.target,
    design_personality: pref.personality,
    layout_intent: family.description,
    section_order,
  };
}

function pickVariantFromSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 3;
}
