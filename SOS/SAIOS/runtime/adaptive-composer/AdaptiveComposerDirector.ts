/**
 * Adaptive Resume Composer — primary composition engine.
 * Composes premium resumes from reusable design components.
 */
import { randomUUID } from "node:crypto";
import { runDesignBrain } from "../design-brain/DesignBrain.js";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { selectDesignFamily } from "../workers/resume-production/family-selector.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { consumeComposerKnowledge } from "./KnowledgeConsumer.js";
import { gatherCompositionPrinciples } from "./ResearchIntegration.js";
import { selectComponents } from "./CompositionSelector.js";
import { buildSpacingStrategy } from "./SpacingIntelligence.js";
import { buildLayoutComposition } from "./LayoutIntelligence.js";
import { buildTypographyStrategy } from "./TypographyIntelligence.js";
import { buildHierarchyStrategy } from "./HierarchyIntelligence.js";
import {
  checkCompositionOriginality,
  computeCompositionFingerprint,
} from "./OriginalityGuard.js";
import { scoreComposition } from "./CompositionScorer.js";
import { persistCompositionArtifacts, resolveCompositionDir } from "./ComposerReporter.js";
import { appendComposerMemory } from "./ComposerMemory.js";
import type { AdaptiveComposerOptions, AdaptiveComposerResult, CompositionMode, CompositionPlan } from "./types.js";
import { PREMIUM_SCORE_TARGET, ATS_SCORE_TARGET, VISUAL_RENDER_TARGET } from "./types.js";

export const ADAPTIVE_COMPOSER = {
  module: "adaptive-resume-composer",
  version: "1.0.0",
  role: "fabric_composition_only",
  description:
    "Primary composition engine — assembles premium resumes from reusable design components. Never generates fixed templates.",
  prohibitions: [
    "no_src_modifications",
    "no_editor_modifications",
    "no_publication_modifications",
    "no_production_worker_modifications",
  ],
  quality_targets: {
    premium_score: PREMIUM_SCORE_TARGET,
    visual_render: VISUAL_RENDER_TARGET,
    ats_score: ATS_SCORE_TARGET,
    founder_prediction: "LIKELY APPROVE",
  },
} as const;

export function allocateCompositionId(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `compose-${ymd}-${randomUUID().slice(0, 8)}`;
}

export async function runAdaptiveComposition(
  options: AdaptiveComposerOptions,
): Promise<AdaptiveComposerResult> {
  const seed = options.seed ?? Date.now() % 1000;
  const mode: CompositionMode = options.mode ?? "premium";
  const country = options.country ?? "US";
  const max_redesigns = options.max_redesigns ?? 3;
  const mcp = options.mcp_firecrawl_available ?? false;
  const persist = options.persist !== false;

  const knowledge = consumeComposerKnowledge(options.objective);
  const research = await gatherCompositionPrinciples(options.objective, mcp);
  const intelligence = loadResumeIntelligenceEngine();
  const family = selectDesignFamily(options.objective, intelligence.database.design_families);

  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 8 });
  const brain = await runDesignBrain({
    objective: options.objective,
    mcp_firecrawl_available: mcp,
    persist: false,
    cursor_executor: executor,
  });

  let redesign_count = 0;
  let originality = { max_similarity: 0, redesign_required: false };
  let plan: CompositionPlan | null = null;

  while (redesign_count <= max_redesigns) {
    const components = selectComponents({
      industry: knowledge.industry.industry,
      mode,
      knowledge,
      seed,
      redesign_offset: redesign_count * 3,
    });

    const header_variant = components.find((c) => c.category === "header")?.variant ?? "modern";
    const layout = buildLayoutComposition({
      industry: knowledge.industry.industry,
      mode,
      seed: seed + redesign_count,
    });
    const spacing = buildSpacingStrategy({ mode, knowledge, header_variant, seed: seed + redesign_count });
    const typography = buildTypographyStrategy({
      mode,
      header_variant,
      seed: seed + redesign_count,
      learning_body_pt: knowledge.learning_typography_body_pt,
    });
    const hierarchy = buildHierarchyStrategy({
      industry: knowledge.industry.industry,
      mode,
      seed: seed + redesign_count,
    });

    const composition_id = allocateCompositionId();
    const draft: Omit<CompositionPlan, "fingerprint"> = {
      composition_id,
      objective: options.objective,
      industry: knowledge.industry.industry,
      mode,
      country,
      section_order: hierarchy.section_order,
      components,
      layout,
      spacing,
      typography,
      hierarchy,
      redesign_count,
    };

    const fingerprint = computeCompositionFingerprint(draft);
    plan = { ...draft, fingerprint };

    const originalityCheck = checkCompositionOriginality({
      plan,
      objective: options.objective,
      industry: knowledge.industry.industry,
      family_id: family.selected_family_id,
      prior_fingerprints: options.prior_fingerprints,
    });

    originality = {
      max_similarity: originalityCheck.max_similarity,
      redesign_required: originalityCheck.redesign_required,
    };

    if (!originalityCheck.redesign_required) break;
    redesign_count++;
  }

  if (!plan) throw new Error("Composition failed — no plan generated");

  const confidence = scoreComposition(plan, mode);
  const output_dir = resolveCompositionDir(plan.composition_id);
  const artifacts = persistCompositionArtifacts({
    output_dir,
    plan,
    confidence,
    research_principles: research.combined,
    persist,
  });

  if (persist) {
    appendComposerMemory({
      recorded_at: new Date().toISOString(),
      composition_id: plan.composition_id,
      objective: options.objective,
      fingerprint: plan.fingerprint,
      layout_mode: plan.layout.layout_mode,
      typography_pairing: `${plan.typography.primary_font}+${plan.typography.secondary_font}`,
      spacing_rhythm_px: plan.spacing.vertical_rhythm_px,
      successful_compositions: [plan.layout.layout_mode, plan.mode],
      successful_spacing: plan.spacing.justification.slice(0, 2),
      successful_typography: plan.typography.justification.slice(0, 2),
      successful_layouts: plan.layout.justification.slice(0, 2),
      successful_hierarchy: plan.hierarchy.justification.slice(0, 2),
      successful_combinations: plan.components.slice(0, 4).map((c) => `${c.category}:${c.variant}`),
    });
  }

  const pass =
    confidence.targets_met.premium &&
    confidence.targets_met.ats &&
    confidence.targets_met.visual_render &&
    confidence.founder_prediction === "LIKELY APPROVE";

  return {
    pass,
    composition_id: plan.composition_id,
    output_dir,
    plan,
    confidence,
    artifacts,
    originality: {
      max_similarity: originality.max_similarity,
      redesign_required: originality.redesign_required,
      redesign_count,
    },
    brain_decisions: brain.decisions,
  };
}
