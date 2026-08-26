/**
 * Visual guidance for DesignBrief → Canvas/BlockRenderer.
 * Agent #237 — Design Family geometry + systems.
 */
import type { BrainPlanningOutput, VisualGuidance } from "./types.js";
import { getVisualProfile } from "./normalizeBrainPlanning.js";
import type { ResolvedDesignFamily } from "../design-families/types.js";

export type { VisualGuidance };

export function buildVisualGuidance(output: BrainPlanningOutput): VisualGuidance {
  const profile = getVisualProfile(output);
  const family = (output.design_family_contract ??
    profile.design_family) as ResolvedDesignFamily | undefined;
  const pageFill = Number(output.page_fill_target ?? profile.page_fill_target ?? 0.88);

  return {
    hero_emphasis: family
      ? `${family.header_system} on ${family.layout_architecture}`
      : "Large name; title; accent rule",
    typography_scale: {
      name_pt: profile.scale[0],
      heading_pt: profile.scale[1],
      body_pt: profile.scale[2],
      meta_pt: profile.scale[3],
    },
    spacing_scale: {
      section_gap_px: profile.section_gap_px,
      item_gap_px: profile.item_gap_px,
      paragraph_gap_px: profile.paragraph_gap_px,
      density: profile.density,
    },
    margin_strategy: `${profile.margins_mm.top}mm — family ${family?.family_id ?? "unknown"}`,
    alignment_rules: [
      String(family?.alignment_system ?? "strict_left"),
      "Text remains Fabric Textbox objects",
      "Shapes must not cover text",
    ],
    section_rhythm: `${profile.section_gap_px}px before sections; title=${family?.section_title_system}`,
    content_density: `page-fill objective ${Math.round(pageFill * 100)}%; density ${profile.density}`,
    visual_weight: "Family silhouette → header → section markers → body",
    divider_strategy: profile.rule_style,
    ats_constraints: [
      "text_as_text_objects",
      "no_images",
      "no_icons",
      "no_tables",
      family?.sidebar_policy === "narrow_ats_safe"
        ? "narrow_ats_safe_sidebar_allowed"
        : "single_column_preferred",
      "high_contrast_text",
    ],
    design_variant: profile.variant,
    visual_profile: profile.label,
    content_profile: profile.content_profile,
    rule_style: profile.rule_style,
    name_weight: profile.name_weight,
    layout_intent: profile.layout_intent,
    visual_hierarchy: `name ${profile.scale[0]}pt → heading ${profile.scale[1]}pt → body ${profile.scale[2]}pt`,
    page_fill_objective: pageFill,
    typography_strategy: `${profile.heading_family} / ${family?.typography_scale.name_weight ?? 700}`,
    spacing_strategy: JSON.stringify(family?.spacing ?? {}),
    design_personality: family?.design_personality ?? profile.design_personality,
    information_density: profile.density,
    visual_rhythm: family?.silhouette_hint,
    layout_family: family?.layout_architecture ?? profile.layout_family,
    role_family: family?.role_family ?? profile.role_family,
    header_style: family?.header_system ?? profile.header_style,
    design_family: family?.family_id,
    layout_architecture: family?.layout_architecture,
    header_system: family?.header_system,
    section_title_system: family?.section_title_system,
    alignment_system: family?.alignment_system,
    accent_shape_strategy: family?.accent_shape_strategy,
    sidebar_policy: family?.sidebar_policy,
    color_strategy: family?.color_strategy,
    spacing_tokens: family?.spacing,
    ats_risk_level: family?.ats_risk_level,
    silhouette_hint: family?.silhouette_hint,
    family_contract: family,
    // OpenAI-backed fictional resume body (Agent #240) — BlockRenderer prefers this
    resume_content:
      output.resume_content ??
      output.openai_resume_content ??
      (output as { content?: unknown }).content ??
      undefined,
    content_source:
      output.resume_content || output.openai_resume_content
        ? "openai"
        : "planning_only",
  };
}
