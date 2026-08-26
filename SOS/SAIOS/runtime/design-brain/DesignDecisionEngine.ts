/**
 * Design decision engine — orchestrates all sub-engines into unified decisions.
 */
import { randomUUID } from "node:crypto";
import type { ValidatedResearch } from "./ResearchIntegration.js";
import { loadBrainMemory } from "./DesignMemory.js";
import { resolveIndustryStyle } from "./IndustryStyleEngine.js";
import { resolveTypography } from "./TypographyEngine.js";
import { resolveSpacing } from "./SpacingEngine.js";
import { resolveGrid } from "./GridEngine.js";
import { resolveColorHarmony } from "./ColorHarmonyEngine.js";
import { resolveWhitespace } from "./WhitespaceEngine.js";
import { resolveVisualHierarchy } from "./VisualHierarchyEngine.js";
import { resolveSectionPriority } from "./SectionPriorityEngine.js";
import { resolveComposition } from "./CompositionEngine.js";
import { resolveBalance } from "./BalanceEngine.js";
import { resolveOriginality } from "./OriginalityEngine.js";
import { resolveTrends } from "./TrendEngine.js";
import { scoreVisualQuality } from "./VisualQualityScorer.js";
import { computeDesignConfidence } from "./DesignConfidence.js";
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { BrainRunOptions, DesignDecisions, QualityScores, DesignConfidenceReport } from "./types.js";
import type { IndustryId } from "../research/types.js";

export type DecisionEngineResult = {
  decisions: DesignDecisions;
  quality: QualityScores;
  confidence: DesignConfidenceReport;
  trends: ReturnType<typeof resolveTrends>;
  whitespace: ReturnType<typeof resolveWhitespace>;
  balance: ReturnType<typeof resolveBalance>;
};

export function runDesignDecisionEngine(
  objective: string,
  research: ValidatedResearch,
  options?: Pick<BrainRunOptions, "industry">,
): DecisionEngineResult {
  const memory = loadBrainMemory();
  const style = resolveIndustryStyle(objective, options?.industry);
  const typography = resolveTypography(style, memory);
  const spacing = resolveSpacing(style, memory);
  const grid = resolveGrid(style, spacing);
  const color = resolveColorHarmony(style, memory);
  const whitespace = resolveWhitespace(style, spacing);
  const { hierarchy, emphasis } = resolveVisualHierarchy(style);
  const { section_order, section_priority } = resolveSectionPriority(style.industry);
  const composition = resolveComposition(objective, style, grid);
  const originality = resolveOriginality({
    objective,
    industry: style.industry,
    layout_family: composition.layout_family,
  });
  const trends = resolveTrends(research, style);
  const balance = resolveBalance(emphasis, whitespace);

  const quality = scoreVisualQuality({
    style,
    typography,
    color,
    whitespace,
    balance,
    hierarchy,
    originality,
  });

  const reasoning = [
    ...style.reasoning,
    ...composition.reasoning,
    ...originality.differentiation,
    ...trends.trends_applied.slice(0, 2),
    ...buildDesignSystemBundle(true).design_dna.brain_directives.slice(0, 3),
  ];

  const decisions: DesignDecisions = {
    decision_id: `decision-${randomUUID().slice(0, 8)}`,
    generated_at: new Date().toISOString(),
    objective,
    industry: style.industry,
    design_language: style.design_language,
    visual_style: style.visual_style,
    layout_family: composition.layout_family,
    grid_system: grid,
    spacing_system: spacing,
    typography_system: typography,
    color_system: color,
    section_order,
    section_priority,
    visual_hierarchy: hierarchy,
    component_emphasis: emphasis,
    ats_mode: style.ats_mode,
    decoration_budget: style.decoration_budget,
    premium_feel: style.premium_feel,
    conservative: style.conservative,
    originality_score: originality.originality_score,
    confidence: 0,
    reasoning,
  };

  const confidence = computeDesignConfidence({
    research,
    memory,
    quality,
    originality,
    decision_factors: reasoning.length,
  });

  decisions.confidence = confidence.overall;

  return { decisions, quality, confidence, trends, whitespace, balance };
}
