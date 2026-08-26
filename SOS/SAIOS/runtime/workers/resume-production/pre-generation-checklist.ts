/**
 * Pre-generation checklist — all plans must pass before Fabric JSON.
 */
import { randomUUID } from "node:crypto";
import type { FamilySelectionResult } from "./family-selector.js";
import type { DuplicateCheckResultV3 } from "./duplicate-detector-v3.js";
import type { PremiumIntegrationContext } from "./types-v3.js";
import type {
  PreGenerationChecklist,
  DesignIntent,
  LayoutSelection,
  VisualStrategy,
  SpacingPlan,
  TypographyPlan,
  ColorPlan,
  HierarchyPlan,
  OriginalityCheck,
  QualityPrediction,
  DesignSystemGatesChecklist,
} from "./types-v3.js";
import type { ProductionDesignBundle } from "./design-bundle.js";
import type { DesignSystemGatesResult } from "./design-system-gates.js";

const PREMIUM_TARGET = 97;
const CALIBRATED_PASS_THRESHOLD = 88;

export function buildPreGenerationChecklist(input: {
  objective: string;
  integration: PremiumIntegrationContext;
  family: FamilySelectionResult;
  duplicate: DuplicateCheckResultV3;
  duplicate_redesigns: number;
  design_bundle: ProductionDesignBundle;
  design_system_gates: DesignSystemGatesResult;
}): PreGenerationChecklist {
  const brain = input.integration.brain_decisions;
  const quality = input.integration.brain_quality;

  const design_intent = buildDesignIntent(input);
  const layout_selection = buildLayoutSelection(input);
  const visual_strategy = buildVisualStrategy(brain);
  const spacing_plan = buildSpacingPlan(brain, input.design_bundle);
  const typography_plan = buildTypographyPlan(brain, input.design_bundle);
  const color_plan = buildColorPlan(brain);
  const hierarchy_plan = buildHierarchyPlan(brain, input.design_bundle);
  const originality_check = buildOriginalityCheck(input.duplicate, input.duplicate_redesigns);
  const quality_prediction = buildQualityPrediction(quality, brain, input.duplicate);

  const design_system_gates = buildDesignSystemGatesChecklist(
    input.design_bundle,
    input.design_system_gates,
  );

  const all_pass =
    design_intent.pass &&
    layout_selection.pass &&
    visual_strategy.pass &&
    spacing_plan.pass &&
    typography_plan.pass &&
    color_plan.pass &&
    hierarchy_plan.pass &&
    originality_check.pass &&
    quality_prediction.pass &&
    design_system_gates.pass;

  return {
    checklist_id: `checklist-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    design_intent,
    layout_selection,
    visual_strategy,
    spacing_plan,
    typography_plan,
    color_plan,
    hierarchy_plan,
    originality_check,
    quality_prediction,
    design_system_gates,
    all_pass,
  };
}

function buildDesignSystemGatesChecklist(
  bundle: ProductionDesignBundle,
  gates: DesignSystemGatesResult,
): DesignSystemGatesChecklist {
  return {
    pass: gates.pass,
    checks: gates.checks,
    design_system_version: bundle.design_system_version,
    bundle_id: bundle.bundle_id,
  };
}

function buildDesignIntent(input: {
  objective: string;
  integration: PremiumIntegrationContext;
}): DesignIntent {
  const pass = input.integration.brain_confidence.overall >= 85;
  return {
    intent_id: `intent-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    objective: input.objective,
    premium_targets: [
      "Visual hierarchy",
      "Premium appearance",
      "Modern spacing",
      "Executive polish",
      "First impression",
      "Download likelihood",
      "Originality",
      "ATS safety",
    ],
    design_sources: [
      "Research Engine",
      "Benchmark Engine",
      "Design Brain",
      "Resume Design System",
      "Learning Memory",
      "Resume Intelligence",
    ],
    benchmark_principles_applied: input.integration.benchmark_patterns_used.slice(0, 5),
    brain_decision_id: input.integration.brain_decisions.decision_id,
    learning_preferences_applied: input.integration.learning_notes,
    pass,
  };
}

function buildLayoutSelection(input: {
  family: FamilySelectionResult;
  duplicate_redesigns: number;
  integration: PremiumIntegrationContext;
}): LayoutSelection {
  const brain = input.integration.brain_decisions;
  return {
    selected_family_id: input.family.selected_family_id,
    layout_pattern: brain.layout_family,
    column_strategy: brain.grid_system.columns === 1 ? "single-column" : "multi-column",
    header_style: brain.premium_feel ? "executive-band" : "professional-header",
    sidebar_usage: false,
    rationale: [
      ...input.family.rationale,
      `Design Brain layout family: ${brain.layout_family}`,
      `Grid: ${brain.grid_system.base_unit_px}px base unit`,
    ],
    duplicate_redesigns: input.duplicate_redesigns,
    pass: input.family.selected_family_id.length > 0,
  };
}

function buildVisualStrategy(brain: PremiumIntegrationContext["brain_decisions"]): VisualStrategy {
  return {
    first_impression_goal: brain.premium_feel
      ? "Executive confidence with calm premium whitespace"
      : "Professional clarity with modern hierarchy",
    premium_feel: brain.premium_feel,
    executive_polish: brain.premium_feel || brain.design_language === "executive-refined",
    download_likelihood_factors: [
      "Clear name and title hierarchy",
      "Calm accent on neutral base",
      "Scannable experience section",
      "Premium whitespace rhythm",
    ],
    user_preference_signals: [
      "Minimal decoration density",
      "ATS-safe structure",
      "Industry-appropriate tone",
    ],
    decoration_budget: brain.decoration_budget,
    pass: brain.decoration_budget <= 15,
  };
}

function buildSpacingPlan(
  brain: PremiumIntegrationContext["brain_decisions"],
  bundle: ProductionDesignBundle,
): SpacingPlan {
  const s = brain.spacing_system;
  const resolved = bundle.resolved;
  return {
    margin_px: resolved.margin_left,
    section_gap_px: resolved.section_gap_px,
    paragraph_gap_px: resolved.paragraph_gap_px,
    header_zone_pct: s.header_zone_pct,
    whitespace_strategy: s.density === "spacious" ? "premium-breathing" : "balanced-rhythm",
    grid_unit_px: bundle.design_system.spacing.baseline_rhythm_px,
    pass: resolved.margin_left >= 40 && resolved.section_gap_px >= 12,
  };
}

function buildTypographyPlan(
  brain: PremiumIntegrationContext["brain_decisions"],
  bundle: ProductionDesignBundle,
): TypographyPlan {
  const t = brain.typography_system;
  const resolved = bundle.resolved;
  return {
    primary_font: resolved.primary_font,
    secondary_font: t.secondary_font,
    name_size_pt: resolved.name_pt,
    title_size_pt: resolved.title_pt,
    section_size_pt: resolved.section_pt,
    body_size_pt: resolved.body_pt,
    line_height: resolved.body_line_height,
    pass: resolved.body_pt >= bundle.design_system.typography.text_density.min_body_pt,
  };
}

function buildColorPlan(brain: PremiumIntegrationContext["brain_decisions"]): ColorPlan {
  const c = brain.color_system;
  return {
    primary_accent: c.primary_accent,
    text: c.text,
    muted: c.muted,
    background: c.background,
    palette_style: c.palette_style,
    contrast_ratio: c.contrast_ratio,
    pass: c.contrast_ratio >= 4.5,
  };
}

function buildHierarchyPlan(
  brain: PremiumIntegrationContext["brain_decisions"],
  bundle: ProductionDesignBundle,
): HierarchyPlan {
  const h = brain.visual_hierarchy;
  const ladder = bundle.design_system.hierarchy.ladder;
  const nameLevel = ladder.find((l) => l.level === "name");
  return {
    reading_order: h.reading_order,
    emphasis_zones: h.emphasis_zones,
    section_priority: brain.section_priority,
    name_weight: nameLevel?.weight ?? h.name_weight,
    pass:
      (nameLevel?.size_pt ?? 0) >= 36 &&
      h.name_weight >= 90 &&
      h.reading_order.length >= 4,
  };
}

function buildOriginalityCheck(
  duplicate: DuplicateCheckResultV3,
  duplicate_redesigns: number,
): OriginalityCheck {
  const exhausted = duplicate_redesigns >= 5;
  return {
    uniqueness_score: duplicate.uniqueness_score,
    max_similarity: duplicate.max_similarity,
    exceeds_threshold: duplicate.exceeds_threshold,
    benchmark_memory_clear: duplicate.benchmark_memory_clear,
    learning_memory_clear: duplicate.learning_memory_clear,
    batch_clear: duplicate.batch_clear,
    redesign_required: duplicate.redesign_required,
    pass: !duplicate.redesign_required || exhausted,
  };
}

function buildQualityPrediction(
  quality: PremiumIntegrationContext["brain_quality"],
  brain: PremiumIntegrationContext["brain_decisions"],
  duplicate: DuplicateCheckResultV3,
): QualityPrediction {
  const boost = duplicate.exceeds_threshold ? -3 : 4;
  const predicted_professional = Math.min(100, quality.professional_appearance + boost);
  const predicted_premium = Math.min(100, quality.premium_perception + boost);
  const predicted_executive = brain.premium_feel ? Math.min(100, predicted_premium + 2) : predicted_professional;
  const predicted_modern = Math.min(100, quality.typography + 2);
  const predicted_originality = Math.min(100, brain.originality_score + boost);
  const predicted_ats = Math.min(100, quality.ats_compatibility);
  const predicted_accessibility = Math.min(100, quality.accessibility);
  const predicted_user_appeal = Math.min(100, Math.round((predicted_premium + predicted_modern) / 2));
  const predicted_click = Math.min(100, predicted_user_appeal - 2);
  const predicted_download = Math.min(100, predicted_user_appeal + 1);
  const overall_confidence = Math.round(
    (predicted_professional +
      predicted_premium +
      predicted_executive +
      predicted_modern +
      predicted_originality +
      predicted_ats +
      predicted_accessibility +
      predicted_user_appeal) /
      8,
  );
  const final = Math.min(100, overall_confidence);

  return {
    predicted_professional,
    predicted_premium,
    predicted_executive,
    predicted_modern,
    predicted_originality,
    predicted_ats,
    predicted_accessibility,
    predicted_user_appeal,
    predicted_click,
    predicted_download,
    overall_confidence: final,
    target_met: final >= PREMIUM_TARGET,
    pass: final >= CALIBRATED_PASS_THRESHOLD,
  };
}

export function writeChecklistArtifacts(
  output_dir: string,
  checklist: PreGenerationChecklist,
  write: (name: string, content: object) => void,
): void {
  write("design-intent.json", checklist.design_intent);
  write("layout-selection.json", checklist.layout_selection);
  write("visual-strategy.json", checklist.visual_strategy);
  write("spacing-plan.json", checklist.spacing_plan);
  write("typography-plan.json", checklist.typography_plan);
  write("color-plan.json", checklist.color_plan);
  write("hierarchy-plan.json", checklist.hierarchy_plan);
  write("originality-check.json", checklist.originality_check);
  write("quality-prediction.json", checklist.quality_prediction);
  write("design-system-gates.json", checklist.design_system_gates);
}
