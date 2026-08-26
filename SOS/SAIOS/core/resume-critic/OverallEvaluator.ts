/**
 * OverallEvaluator — aggregate category scores.
 * Agent #239 — thumbnail + contrast merge; no auto-100.
 */
import { evaluateThumbnailAppeal } from "../design-families/ThumbnailDistinctnessCritic.js";
import type { VisualFingerprint } from "../design-families/visualFingerprint.js";
import { weightedOverall } from "./CriticScore.js";
import { evaluateAts } from "./ATSCritic.js";
import { evaluateContrast } from "./ContrastCritic.js";
import { evaluateVisual } from "./VisualCritic.js";
import { evaluateTypography } from "./TypographyCritic.js";
import { evaluateLayout } from "./LayoutCritic.js";
import { evaluateTechnical } from "./TechnicalCritic.js";
import { evaluateConsistency } from "./ConsistencyCritic.js";
import { evaluateSections } from "./SectionCritic.js";
import { evaluateSpacing } from "./SpacingCritic.js";
import type {
  CategoryReport,
  CriticCategory,
  CriticInput,
  CriticScores,
} from "./types.js";

export type EvaluationBundle = {
  scores: CriticScores & {
    thumbnail_appeal?: number;
    contrast?: number;
  };
  reports: Record<CriticCategory, CategoryReport>;
  spacing_detail: CategoryReport;
  thumbnail_appeal: CategoryReport;
  contrast_detail: CategoryReport;
  visual_fingerprint: VisualFingerprint;
};

export function evaluateAll(
  input: CriticInput & { batch_fingerprints?: VisualFingerprint[] },
): EvaluationBundle {
  const ats = evaluateAts(input);
  const visual = evaluateVisual(input);
  const typography = evaluateTypography(input);
  const layout = evaluateLayout(input);
  const technical = evaluateTechnical(input);
  const consistency = evaluateConsistency(input);
  const sections = evaluateSections(input);
  const spacing_detail = evaluateSpacing(input);
  const thumbnail_appeal = evaluateThumbnailAppeal(input);
  const contrast_detail = evaluateContrast(input);

  const layoutCodes = new Set(layout.findings.map((f) => f.code));
  for (const f of spacing_detail.findings) {
    if (!layoutCodes.has(f.code)) {
      layout.findings.push(f);
      layout.score = Math.max(0, layout.score - f.points_deducted);
    }
  }

  const mergedVisualScore = Math.round(
    visual.score * 0.55 +
      thumbnail_appeal.score * 0.3 +
      contrast_detail.score * 0.15,
  );
  visual.score = mergedVisualScore;
  for (const f of [...thumbnail_appeal.findings, ...contrast_detail.findings]) {
    if (!visual.findings.some((v) => v.code === f.code)) {
      visual.findings.push(f);
    }
  }
  visual.metrics = {
    ...visual.metrics,
    thumbnail_appeal: thumbnail_appeal.score,
    contrast: contrast_detail.score,
    contrast_pass: contrast_detail.metrics?.contrast_pass === true,
    fingerprint_hash: thumbnail_appeal.fingerprint.fingerprint_hash,
    nearest_similarity: thumbnail_appeal.nearest_similarity,
  };

  const partial = {
    ats: ats.score,
    visual: visual.score,
    typography: typography.score,
    layout: layout.score,
    technical: technical.score,
    consistency: consistency.score,
    sections: sections.score,
  };
  const overall = weightedOverall(partial);

  return {
    scores: {
      overall,
      ...partial,
      thumbnail_appeal: thumbnail_appeal.score,
      contrast: contrast_detail.score,
    },
    reports: {
      ats,
      visual,
      typography,
      layout,
      technical,
      consistency,
      sections,
    },
    spacing_detail,
    thumbnail_appeal,
    contrast_detail,
    visual_fingerprint: thumbnail_appeal.fingerprint,
  };
}
