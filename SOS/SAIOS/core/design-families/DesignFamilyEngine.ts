/**
 * Agent #237 — Design Family Engine.
 * Reasoning order: family → visual system → ATS → role → content/canvas.
 * Not a new runtime. Consumed by DesignBrief before role adaptation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DESIGN_FAMILIES, DESIGN_FAMILY_IDS, getDesignFamily } from "./families.js";
import type {
  DesignFamilyId,
  ResolvedDesignFamily,
} from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");

const ROLE_POOL = [
  "marketing_manager",
  "software_engineer",
  "graphic_designer",
  "accountant",
  "hr_manager",
] as const;

export function parseDesignFamilyId(raw: unknown): DesignFamilyId | null {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if ((DESIGN_FAMILY_IDS as string[]).includes(s)) return s as DesignFamilyId;
  const aliases: Record<string, DesignFamilyId> = {
    exec: "executive",
    corp: "corporate",
    side: "professional_sidebar",
    sidebar: "professional_sidebar",
    accent: "contemporary_accent",
    contemp: "contemporary_accent",
  };
  return aliases[s] ?? null;
}

export function pickDesignFamilyFromSeed(seed: string): DesignFamilyId {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DESIGN_FAMILY_IDS[h % DESIGN_FAMILY_IDS.length]!;
}

export function selectRoleForFamily(
  familyId: DesignFamilyId,
  variant: 0 | 1,
  preferred?: string | null,
): string {
  // Phase 6A: never silently substitute an unrelated profession for design-family
  // suitability. Preferred production target role is authoritative when present.
  if (preferred && String(preferred).trim()) {
    return preferred.toLowerCase().replace(/[\s-]+/g, "_");
  }
  const family = getDesignFamily(familyId);
  const suited = family.role_suitability;
  if (suited.length) {
    return suited[variant % suited.length]!;
  }
  return ROLE_POOL[variant % ROLE_POOL.length]!;
}

/**
 * 1) Select design family
 * 2) Build family-specific visual system (contract)
 * 3) ATS constraints already encoded in contract
 * 4) Adapt to role
 */
export function resolveDesignFamily(input: {
  family_id?: string | null;
  design_variant?: number;
  role_family?: string | null;
  seed?: string | null;
}): ResolvedDesignFamily {
  const seed = input.seed ?? "";
  const fromNotes = seed.match(/design_family\s*[:=]?\s*([a-z_]+)/i);
  const familyId =
    parseDesignFamilyId(input.family_id) ??
    (fromNotes ? parseDesignFamilyId(fromNotes[1]) : null) ??
    pickDesignFamilyFromSeed(seed || "default");

  const variantFromSeed = seed.match(/design_variant\s*[:=]?\s*(\d+)/i);
  const variantRaw =
    input.design_variant !== undefined && input.design_variant !== null
      ? Number(input.design_variant)
      : variantFromSeed
        ? Number(variantFromSeed[1])
        : 0;
  const variant = (Math.abs(variantRaw || 0) % 2) as 0 | 1;
  const base = getDesignFamily(familyId);
  const role_family = selectRoleForFamily(
    familyId,
    variant,
    input.role_family,
  );

  // Agent #239 — family-specific variant profiles (≥4 dimension deltas)
  const resolved = applyHardenedVariant(base, variant, familyId);

  return {
    ...resolved,
    variant,
    role_family,
    selected_at: new Date().toISOString(),
    reasoning_order: [
      "1_select_design_family",
      "2_build_family_visual_system",
      "3_apply_ats_constraints",
      "4_adapt_design_to_role",
      "5_generate_content_and_canvas",
      "6_evaluate_visual_distinctness",
      "7_render_preview_and_thumbnail",
    ],
  };
}

function applyHardenedVariant(
  base: ReturnType<typeof getDesignFamily>,
  variant: 0 | 1,
  familyId: DesignFamilyId,
): ReturnType<typeof getDesignFamily> {
  if (variant === 0) {
    // Strengthen weak v0 families for Founder bar
    if (familyId === "editorial") {
      return {
        ...base,
        section_title_system: "pale_strip",
        accent_shape_strategy: "pale_strips",
        divider_strategy: "short",
        spacing: {
          ...base.spacing,
          density: "standard",
          section_before_gap_px: 22,
        },
        page_fill_target: 0.9,
        silhouette_hint: "editorial-offset-pale-strips",
      };
    }
    if (familyId === "creative") {
      return {
        ...base,
        accent_shape_strategy: "left_rail",
        section_title_system: "geometric_marker",
        header_system: "oversized_name_split_contact",
        page_fill_target: 0.9,
        silhouette_hint: "creative-rail-geometric",
      };
    }
    if (familyId === "professional_sidebar") {
      return {
        ...base,
        spacing: {
          ...base.spacing,
          density: "compact",
          section_before_gap_px: 12,
          bullet_gap_px: 2,
        },
        page_fill_target: 0.92,
        section_title_system: "sidebar_label",
      };
    }
    return base;
  }

  // Variant 1 — material composition deltas (Agent #239)
  const spacing = { ...base.spacing };
  let layout_architecture = base.layout_architecture;
  let header_system = base.header_system;
  let section_title_system = base.section_title_system;
  let divider_strategy = base.divider_strategy;
  let accent_shape_strategy = base.accent_shape_strategy;
  let alignment_system = base.alignment_system;
  const color_strategy = { ...base.color_strategy };
  let silhouette_hint = base.silhouette_hint;
  let page_fill_target = base.page_fill_target;

  switch (familyId) {
    case "executive":
      // Premium band vs restrained split corporate
      header_system = "oversized_name_split_contact";
      section_title_system = "filled_label";
      alignment_system = "split_header_right_contact";
      accent_shape_strategy = "filled_labels";
      divider_strategy = "none";
      layout_architecture = "compact_corporate";
      spacing.density = "compact";
      spacing.section_before_gap_px = 18;
      color_strategy.accent = "#1e293b";
      color_strategy.header_band = undefined;
      color_strategy.pale_tint = "#e2e8f0";
      silhouette_hint = "executive-split-filled-labels";
      break;
    case "contemporary_accent":
      // Edge rail vs header-block / section-strip
      header_system = "muted_band_name_block";
      alignment_system = "strict_left";
      section_title_system = "pale_strip";
      accent_shape_strategy = "pale_strips";
      divider_strategy = "none";
      layout_architecture = "header_band";
      spacing.density = "compact";
      spacing.section_before_gap_px = 18;
      color_strategy.accent = "#0f766e";
      color_strategy.header_band = "#ccfbf1";
      silhouette_hint = "contemporary-muted-band-strips";
      break;
    case "editorial":
      header_system = "oversized_name_split_contact";
      section_title_system = "geometric_marker";
      accent_shape_strategy = "section_markers";
      alignment_system = "split_header_right_contact";
      divider_strategy = "short";
      spacing.density = "standard";
      spacing.section_before_gap_px = 20;
      color_strategy.accent = "#c2410c";
      silhouette_hint = "editorial-split-geometric";
      page_fill_target = 0.9;
      break;
    case "creative":
      header_system = "muted_band_name_block";
      section_title_system = "numbered_marker";
      accent_shape_strategy = "geometric_dots";
      alignment_system = "strict_left";
      layout_architecture = "header_band";
      divider_strategy = "full";
      spacing.density = "compact";
      color_strategy.header_band = "#ede9fe";
      color_strategy.accent = "#6d28d9";
      silhouette_hint = "creative-muted-band-numbered";
      page_fill_target = 0.91;
      break;
    case "professional_sidebar":
      header_system = "muted_band_name_block";
      section_title_system = "vertical_accent_bar";
      accent_shape_strategy = "section_markers";
      spacing.density = "standard";
      spacing.section_before_gap_px = 16;
      color_strategy.header_band = "#dbeafe";
      color_strategy.sidebar_bg = "#e2e8f0";
      color_strategy.accent = "#1e3a8a";
      silhouette_hint = "sidebar-muted-band-accent-bars";
      page_fill_target = 0.92;
      break;
    case "corporate":
      header_system = "split_header_meta_column";
      section_title_system = "pale_strip";
      accent_shape_strategy = "pale_strips";
      alignment_system = "grid_two_track";
      spacing.density = "standard";
      color_strategy.accent = "#1d4ed8";
      silhouette_hint = "corporate-split-pale-strips";
      break;
    case "modern":
      header_system = "dark_band_full";
      section_title_system = "vertical_accent_bar";
      accent_shape_strategy = "header_band";
      alignment_system = "strict_left";
      spacing.density = "compact";
      color_strategy.header_band = "#0c4a6e";
      color_strategy.accent = "#0284c7";
      silhouette_hint = "modern-dark-band-vertical-bars";
      break;
    case "minimal":
      header_system = "oversized_name_split_contact";
      section_title_system = "uppercase_compact";
      accent_shape_strategy = "none";
      alignment_system = "split_header_right_contact";
      spacing.density = "compact";
      spacing.section_before_gap_px = 18;
      silhouette_hint = "minimal-split-compact";
      break;
    case "technical":
      header_system = "dark_band_full";
      section_title_system = "full_width_divider";
      accent_shape_strategy = "header_band";
      alignment_system = "strict_left";
      spacing.density = "standard";
      color_strategy.header_band = "#0c4a6e";
      silhouette_hint = "technical-dark-band-dividers";
      break;
    case "swiss":
      header_system = "oversized_name_split_contact";
      section_title_system = "full_width_divider";
      accent_shape_strategy = "section_markers";
      alignment_system = "split_header_right_contact";
      spacing.density = "compact";
      color_strategy.accent = "#b91c1c";
      silhouette_hint = "swiss-split-full-dividers";
      break;
    default:
      header_system = "compact_corporate";
      section_title_system = "text_short_rule";
      accent_shape_strategy = "section_markers";
      spacing.density = "compact";
  }

  return {
    ...base,
    layout_architecture,
    header_system,
    section_title_system,
    divider_strategy,
    accent_shape_strategy,
    alignment_system,
    spacing,
    color_strategy,
    silhouette_hint,
    page_fill_target,
  };
}

function nudgeAccent(hex: string, familyId: string): string {
  const map: Record<string, string> = {
    executive: "#1e293b",
    corporate: "#1d4ed8",
    modern: "#0284c7",
    editorial: "#c2410c",
    minimal: "#404040",
    creative: "#6d28d9",
    technical: "#075985",
    swiss: "#b91c1c",
    professional_sidebar: "#1e3a8a",
    contemporary_accent: "#0f766e",
  };
  return map[familyId] ?? hex;
}

export function persistDesignFamilyCatalog(repoRoot?: string): string {
  const root = repoRoot ?? REPO;
  const outDir = join(
    root,
    "SOS/SAIOS/domain/studiosislab/resume/intelligence/data",
  );
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "design-family-catalog-v1.json");
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: "1.0.0",
        agent: 237,
        live: false,
        publication_allowed: false,
        families: DESIGN_FAMILIES,
        family_ids: DESIGN_FAMILY_IDS,
        generated_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const logDir = join(root, "SOS/07_LOGS/saios/design-families");
  mkdirSync(logDir, { recursive: true });
  writeFileSync(
    join(logDir, "design-family-engine.json"),
    `${JSON.stringify(
      {
        agent: 237,
        stage: "design_family_engine",
        family_count: DESIGN_FAMILY_IDS.length,
        family_ids: DESIGN_FAMILY_IDS,
        dry_run: true,
        publication_allowed: false,
        live: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return path;
}

export { DESIGN_FAMILIES, DESIGN_FAMILY_IDS, getDesignFamily, ROLE_POOL };
