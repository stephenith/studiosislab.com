/**
 * Production Design Bundle — immutable merge of Research, Benchmark, Design Brain, Design System.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDesignSystemBundle,
  type DesignSystemBundle,
} from "../../design-system/DesignSystemDirector.js";
import { getGridLayout } from "../../design-system/GridSystem.js";
import { getHeaderVariant } from "../../design-system/HeaderSystem.js";
import { getColorPalette } from "../../design-system/ColorTokenSystem.js";
import { DESIGN_SYSTEM_VERSION } from "../../design-system/types.js";
import type { GridLayoutId, HeaderVariantId, ColorPaletteId } from "../../design-system/types.js";
import type { DesignDecisions } from "../../design-brain/types.js";
import { loadDesignMemory } from "../resume-learning/design-memory.js";
import type { PremiumIntegrationContext } from "./types-v3.js";
import type { TemplateSpec } from "./template-builder.js";

export type DesignBundleSelection = {
  grid_id: GridLayoutId;
  layout_id: GridLayoutId;
  header_variant_id: HeaderVariantId;
  color_palette_id: ColorPaletteId;
  components: string[];
};

export type ProductionDesignBundle = {
  bundle_id: string;
  generated_at: string;
  design_system_version: string;
  sources: {
    research_session_id: string;
    brain_decision_id: string;
    benchmark_patterns: string[];
    learning_notes: string[];
  };
  design_system: DesignSystemBundle;
  selection: DesignBundleSelection;
  resolved: TemplateSpec & {
    primary_font: string;
    color_text: string;
    color_muted: string;
    color_subtle: string;
    color_divider: string;
    canvas_width: number;
    canvas_height: number;
    dna_scan_path: string[];
    dna_signature_id: string;
    dna_focal_experience: number;
  };
};

function mapBrainToGrid(brain: DesignDecisions): GridLayoutId {
  if (brain.grid_system.columns > 1) return "sidebar";
  if (brain.design_language === "executive-refined") return "executive";
  if (brain.design_language === "minimal-ats") return "minimal";
  if (brain.design_language === "technical-precise") return "technical";
  if (brain.ats_mode === "ats_first") return "classic-ats";
  if (brain.premium_feel) return "corporate";
  return "modern";
}

function mapBrainToHeader(brain: DesignDecisions): HeaderVariantId {
  if (brain.design_language === "executive-refined") return "executive";
  if (brain.design_language === "healthcare-clinical") return "healthcare";
  if (brain.design_language === "technical-precise") return "technical";
  if (brain.design_language === "creative-expressive") return "creative";
  if (brain.conservative) return "corporate";
  if (brain.premium_feel) return "executive";
  return "minimal";
}

function mapBrainToPalette(brain: DesignDecisions): ColorPaletteId {
  if (brain.color_system.palette_style === "executive-neutral") return "executive-navy";
  if (brain.color_system.palette_style === "creative-accent") return "indigo";
  if (brain.conservative) return "minimal-gray";
  if (brain.premium_feel) return "corporate-blue";
  return "slate";
}

export function buildProductionDesignBundle(
  integration: PremiumIntegrationContext,
): ProductionDesignBundle {
  const design_system = buildDesignSystemBundle(true);
  const brain = integration.brain_decisions;

  const grid_id = mapBrainToGrid(brain);
  const header_variant_id = mapBrainToHeader(brain);
  const color_palette_id = mapBrainToPalette(brain);

  const grid = getGridLayout(grid_id)!;
  const header = getHeaderVariant(header_variant_id)!;
  const palette = getColorPalette(color_palette_id)!;

  const display = design_system.typography.roles.find((r) => r.role === "display")!;
  const heading = design_system.typography.roles.find((r) => r.role === "heading")!;
  const section = design_system.typography.roles.find((r) => r.role === "section")!;
  const body = design_system.typography.roles.find((r) => r.role === "body")!;
  const label = design_system.typography.roles.find((r) => r.role === "label")!;

  const canvas_width = design_system.grid.canvas.width;
  const canvas_height = design_system.grid.canvas.height;

  const memory = loadDesignMemory();
  const section_order =
    memory.preferred_sections.order.length >= 4
      ? memory.preferred_sections.order
      : brain.section_order;

  const rhythm = design_system.header_rhythm.rhythm;
  const hierarchy = design_system.hierarchy.spec;
  const premiumHeader = design_system.premium_header.composition;
  const sectionRhythm = design_system.section_rhythm.transitions;
  const identity = design_system.premium_identity;
  const density = design_system.content_density.computed;
  const pageWidth = design_system.page_width;
  const visualLang = design_system.visual_language;
  const experienceBlock = design_system.experience_block.resolved;
  const designDna = design_system.design_dna;

  const margin = pageWidth.margins.left_px;
  const content_w = pageWidth.content_width_px;

  const resolved: ProductionDesignBundle["resolved"] = {
    margin_left: margin,
    margin_right: margin,
    content_w,
    accent: palette.accent,
    name_pt: display.size_pt,
    title_pt: heading.size_pt,
    contact_pt: label.size_pt,
    section_pt: section.size_pt,
    body_pt: body.size_pt,
    body_line_height: body.line_height,
    name_line_height: display.line_height,
    section_char_spacing: Math.round(section.letter_spacing * 1000),
    section_gap_px: design_system.spacing.section_spacing_px,
    heading_body_gap_px: design_system.spacing.heading_body_gap_px,
    paragraph_gap_px: design_system.spacing.paragraph_spacing_px,
    bullet_line_px: hierarchy.bullet_line_px,
    plain_line_px: design_system.spacing.paragraph_spacing_px + 10,
    header_top_px: header.spacing_px.top,
    header_to_content_px:
      header.spacing_px.bottom +
      rhythm.contact_to_summary_gap_px +
      design_system.spacing.heading_body_gap_px,
    header_name_below_accent_gap_px: rhythm.name_below_accent_gap_px,
    header_name_to_title_gap_px: Math.max(rhythm.name_to_title_gap_px, header.spacing_px.name_to_title),
    header_title_to_contact_gap_px: Math.max(
      rhythm.title_to_contact_gap_px,
      header.spacing_px.title_to_contact,
    ),
    header_contact_to_summary_gap_px: Math.max(
      rhythm.contact_to_summary_gap_px,
      header.spacing_px.contact_to_content,
    ),
    section_order,
    name_weight: hierarchy.name_weight,
    title_weight: visualLang.typography.title_weight,
    section_weight: hierarchy.section_weight,
    job_title_pt: experienceBlock.role_pt,
    date_pt: experienceBlock.date_pt,
    experience_entry_gap_px: experienceBlock.entry_gap_px,
    role_to_date_gap_px: hierarchy.role_to_date_gap_px,
    date_to_bullet_gap_px: design_system.experience_block.spec.date_to_bullet_gap_px,
    accent_bar_height_px: premiumHeader.accent_bar.height_px,
    accent_bar_width_px: premiumHeader.accent_bar.width_px,
    header_rule_width_px: premiumHeader.header_rule.width_px,
    header_rule_thickness_px: premiumHeader.header_rule.thickness_px,
    header_rule_gap_below_contact_px: premiumHeader.header_rule.gap_below_contact_px,
    contact_letter_spacing: premiumHeader.contact.letter_spacing,
    section_transitions: { ...sectionRhythm },
    section_marker_width_px: identity.section_marker.width_px,
    section_marker_height_px: identity.section_marker.height_px,
    section_rule_thickness_px: identity.section_rule.thickness_px,
    section_rule_gap_below_heading_px: identity.section_rule.gap_below_heading_px,
    section_rule_gap_above_content_px: identity.section_rule.gap_above_content_px,
    bullet_gap_px: density.bullet_gap_px,
    title_letter_spacing: visualLang.typography.title_letter_spacing,
    role_company_split: visualLang.experience.role_company_split,
    company_pt: experienceBlock.company_pt,
    company_weight: design_system.experience_block.spec.company_weight,
    role_to_company_gap_px: visualLang.experience.role_to_company_gap_px,
    company_to_date_gap_px: design_system.experience_block.spec.company_to_date_gap_px,
    experience_marker_width_px: visualLang.experience.marker_width_px,
    bullet_metric_weight: design_system.experience_block.spec.bullet_metric_weight,
    experience_role_weight: experienceBlock.role_weight,
    dna_scan_path: designDna.resolved.scan_path,
    dna_signature_id: designDna.resolved.signature_id,
    dna_focal_experience: designDna.resolved.focal_weights.experience,
    primary_font: brain.typography_system.primary_font,
    color_text: palette.text,
    color_muted: palette.primary,
    color_subtle: palette.text,
    color_divider: "#e5e7eb",
    canvas_width,
    canvas_height,
  };

  const components = design_system.components.components
    .filter((c) => c.ats_safe)
    .slice(0, 8)
    .map((c) => c.id);

  return {
    bundle_id: `bundle-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    design_system_version: DESIGN_SYSTEM_VERSION,
    sources: {
      research_session_id: integration.research_session_id,
      brain_decision_id: brain.decision_id,
      benchmark_patterns: integration.benchmark_patterns_used,
      learning_notes: integration.learning_notes,
    },
    design_system,
    selection: {
      grid_id,
      layout_id: grid_id,
      header_variant_id,
      color_palette_id,
      components,
    },
    resolved,
  };
}

export function writeDesignBundleArtifacts(
  output_dir: string,
  bundle: ProductionDesignBundle,
): string[] {
  mkdirSync(output_dir, { recursive: true });
  const files: string[] = [];

  const write = (name: string, content: object) => {
    writeFileSync(join(output_dir, name), JSON.stringify(content, null, 2));
    files.push(name);
  };

  write("design-bundle.json", {
    bundle_id: bundle.bundle_id,
    generated_at: bundle.generated_at,
    design_system_version: bundle.design_system_version,
    sources: bundle.sources,
    selection: bundle.selection,
    resolved: bundle.resolved,
  });
  write("layout-used.json", {
    grid_id: bundle.selection.grid_id,
    layout_id: bundle.selection.layout_id,
    layout: bundle.design_system.layout.layouts.find((l) => l.id === bundle.selection.layout_id),
  });
  write("typography-used.json", {
    roles: bundle.design_system.typography.roles,
    resolved: {
      name_pt: bundle.resolved.name_pt,
      title_pt: bundle.resolved.title_pt,
      section_pt: bundle.resolved.section_pt,
      body_pt: bundle.resolved.body_pt,
      contact_pt: bundle.resolved.contact_pt,
      primary_font: bundle.resolved.primary_font,
    },
  });
  write("spacing-used.json", {
    scale: bundle.design_system.spacing.scale,
    header_rhythm: bundle.design_system.header_rhythm.rhythm,
    resolved: {
      margin_px: bundle.resolved.margin_left,
      section_gap_px: bundle.resolved.section_gap_px,
      paragraph_gap_px: bundle.resolved.paragraph_gap_px,
      heading_body_gap_px: bundle.resolved.heading_body_gap_px,
      bullet_line_px: bundle.resolved.bullet_line_px,
      header_top_px: bundle.resolved.header_top_px,
      header_to_content_px: bundle.resolved.header_to_content_px,
    },
  });
  write("component-selection.json", {
    selected: bundle.selection.components,
    library_size: bundle.design_system.components.components.length,
  });
  write("grid-selection.json", {
    grid_id: bundle.selection.grid_id,
    grid: bundle.design_system.grid.layouts.find((g) => g.id === bundle.selection.grid_id),
  });
  write("design-system-version.json", {
    version: bundle.design_system_version,
    module: "resume-design-system",
    role: "single_source_of_truth",
    generated_at: bundle.generated_at,
  });

  return files;
}
