/**
 * Design System Director — assembles all systems and validates.
 */
import { buildDesignTokens, buildTokenReference } from "./DesignTokens.js";
import { loadDesignMemoryContext } from "./DesignMemoryBridge.js";
import { buildTypographySystem } from "./TypographySystem.js";
import { buildSpacingSystem } from "./SpacingSystem.js";
import { buildGridSystem } from "./GridSystem.js";
import { buildMarginSystem } from "./MarginSystem.js";
import { buildLayoutSystem } from "./LayoutSystem.js";
import { buildHeaderSystem } from "./HeaderSystem.js";
import { buildHeaderRhythmSystem } from "./HeaderRhythmSystem.js";
import { buildHierarchySystem } from "./HierarchySystem.js";
import { buildPremiumHeaderSystem } from "./PremiumHeaderSystem.js";
import { buildSectionRhythmSystem } from "./SectionRhythmSystem.js";
import { buildPremiumIdentitySystem } from "./PremiumIdentitySystem.js";
import { buildContentDensitySystem } from "./ContentDensitySystem.js";
import { buildPageWidthSystem } from "./PageWidthSystem.js";
import { buildVisualLanguageSystem } from "./VisualLanguageSystem.js";
import { buildExperienceBlockSystem } from "./ExperienceBlockSystem.js";
import { buildDesignDNASystem, validateDesignDNA } from "./DesignDNA.js";
import { buildSectionSystem } from "./SectionSystem.js";
import { buildSidebarSystem } from "./SidebarSystem.js";
import { buildDividerSystem } from "./DividerSystem.js";
import { buildBulletSystem } from "./BulletSystem.js";
import { buildIconSystem } from "./IconSystem.js";
import { buildColorTokenSystem } from "./ColorTokenSystem.js";
import { buildATSDesignRules } from "./ATSDesignRules.js";
import { buildComponentLibrary } from "./ComponentLibrary.js";
import { buildDesignConstraints } from "./DesignConstraints.js";
import { buildAccessibilityRules } from "./AccessibilityRules.js";
import { buildResponsiveRules } from "./ResponsiveRules.js";
import { validateDesignSystem } from "./DesignValidator.js";
import { persistDesignSystemReports } from "./Reports.js";
import type { DesignSystemResult, RunDesignSystemOptions } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export const RESUME_DESIGN_SYSTEM = {
  module: "resume-design-system",
  version: DESIGN_SYSTEM_VERSION,
  role: "single_source_of_truth",
} as const;

export type DesignSystemBundle = {
  tokens: ReturnType<typeof buildDesignTokens>;
  token_reference: ReturnType<typeof buildTokenReference>;
  typography: ReturnType<typeof buildTypographySystem>;
  spacing: ReturnType<typeof buildSpacingSystem>;
  grid: ReturnType<typeof buildGridSystem>;
  margins: ReturnType<typeof buildMarginSystem>;
  layout: ReturnType<typeof buildLayoutSystem>;
  headers: ReturnType<typeof buildHeaderSystem>;
  header_rhythm: ReturnType<typeof buildHeaderRhythmSystem>;
  hierarchy: ReturnType<typeof buildHierarchySystem>;
  premium_header: ReturnType<typeof buildPremiumHeaderSystem>;
  section_rhythm: ReturnType<typeof buildSectionRhythmSystem>;
  premium_identity: ReturnType<typeof buildPremiumIdentitySystem>;
  content_density: ReturnType<typeof buildContentDensitySystem>;
  page_width: ReturnType<typeof buildPageWidthSystem>;
  visual_language: ReturnType<typeof buildVisualLanguageSystem>;
  experience_block: ReturnType<typeof buildExperienceBlockSystem>;
  design_dna: ReturnType<typeof buildDesignDNASystem>;
  sections: ReturnType<typeof buildSectionSystem>;
  sidebar: ReturnType<typeof buildSidebarSystem>;
  dividers: ReturnType<typeof buildDividerSystem>;
  bullets: ReturnType<typeof buildBulletSystem>;
  icons: ReturnType<typeof buildIconSystem>;
  colors: ReturnType<typeof buildColorTokenSystem>;
  ats: ReturnType<typeof buildATSDesignRules>;
  components: ReturnType<typeof buildComponentLibrary>;
  constraints: ReturnType<typeof buildDesignConstraints>;
  accessibility: ReturnType<typeof buildAccessibilityRules>;
  responsive: ReturnType<typeof buildResponsiveRules>;
};

export function buildDesignSystemBundle(
  applyCalibration = true,
): DesignSystemBundle {
  const ctx = loadDesignMemoryContext(applyCalibration);

  return {
    tokens: buildDesignTokens(),
    token_reference: buildTokenReference(),
    typography: buildTypographySystem(ctx),
    spacing: buildSpacingSystem(ctx),
    grid: buildGridSystem(),
    margins: buildMarginSystem(),
    layout: buildLayoutSystem(),
    headers: buildHeaderSystem(),
    header_rhythm: buildHeaderRhythmSystem(ctx),
    hierarchy: buildHierarchySystem(ctx),
    premium_header: buildPremiumHeaderSystem(ctx),
    section_rhythm: buildSectionRhythmSystem(ctx),
    premium_identity: buildPremiumIdentitySystem(ctx),
    content_density: buildContentDensitySystem(ctx),
    page_width: buildPageWidthSystem(ctx),
    visual_language: buildVisualLanguageSystem(ctx),
    experience_block: buildExperienceBlockSystem(ctx),
    design_dna: buildDesignDNASystem(ctx),
    sections: buildSectionSystem(),
    sidebar: buildSidebarSystem(),
    dividers: buildDividerSystem(),
    bullets: buildBulletSystem(),
    icons: buildIconSystem(),
    colors: buildColorTokenSystem(),
    ats: buildATSDesignRules(),
    components: buildComponentLibrary(),
    constraints: buildDesignConstraints(),
    accessibility: buildAccessibilityRules(),
    responsive: buildResponsiveRules(),
  };
}

export async function runDesignSystem(
  options: RunDesignSystemOptions = {},
): Promise<DesignSystemResult> {
  const persist = options.persist !== false;
  const applyCalibration = options.apply_founder_calibration !== false;

  const bundle = buildDesignSystemBundle(applyCalibration);
  const validation = validateDesignSystem(bundle);

  const designSystem = {
    module: RESUME_DESIGN_SYSTEM.module,
    version: DESIGN_SYSTEM_VERSION,
    role: RESUME_DESIGN_SYSTEM.role,
    generated_at: new Date().toISOString(),
    summary: {
      spacing_tokens: bundle.spacing.scale.length,
      typography_roles: bundle.typography.roles.length,
      grid_layouts: bundle.grid.layouts.length,
      header_variants: bundle.headers.variants.length,
      section_variants: bundle.sections.variants.length,
      color_palettes: bundle.colors.palettes.length,
      components: bundle.components.components.length,
      ats_rules: bundle.ats.component_rules.length,
      accessibility_rules: bundle.accessibility.spacing_rules.length,
      design_dna_concepts: bundle.design_dna.concept_count,
    },
    validation: {
      pass: validation.pass,
      checks: validation.checks,
    },
  };

  const { outputDir, artifacts } = persistDesignSystemReports({
    bundle,
    designSystem,
    validation,
    persist,
  });

  return {
    pass: validation.pass,
    version: DESIGN_SYSTEM_VERSION,
    output_dir: outputDir,
    validation,
    artifacts,
    summary: designSystem.summary,
  };
}
