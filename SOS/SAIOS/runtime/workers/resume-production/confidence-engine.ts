/**
 * Confidence engine — design, ATS, visual, editor, overall (0–100).
 */
import type { DesignQAReport } from "./design-qa.js";
import type { ValidationReport } from "./validator.js";
import type { ConfidenceScores } from "./types-v2.js";
import type { SelfCritiqueReport } from "./types-v2.js";
import type { DuplicateCheckResult } from "./duplicate-detector.js";

const TARGET_OVERALL = 95;

export function computeConfidence(input: {
  designQa: DesignQAReport;
  validation: ValidationReport;
  duplicate: DuplicateCheckResult;
  critique1: SelfCritiqueReport;
  critique2: SelfCritiqueReport;
  editor_pass: boolean;
}): ConfidenceScores {
  const design_checks = input.designQa.checks.filter((c) =>
    ["alignment", "spacing", "hierarchy", "balance"].includes(c.category),
  );
  const design_confidence = pct(design_checks);

  const ats_checks = input.designQa.checks.filter((c) => c.category === "ats");
  const ats_confidence = Math.round(
    (pct(ats_checks) + (input.validation.pass ? 98 : 70)) / 2,
  );

  const visual_checks = input.designQa.checks.filter((c) =>
    ["typography", "balance", "hierarchy"].includes(c.category),
  );
  const visual_confidence = pct(visual_checks);

  const editor_checks = input.designQa.checks.filter((c) => c.category === "editor");
  const editor_compatibility = input.editor_pass
    ? Math.max(pct(editor_checks), 96)
    : pct(editor_checks);

  const uniqueness_boost = input.duplicate.exceeds_threshold ? -5 : 8;
  const critique_boost = Math.round(
    (input.critique2.confidence_after - input.critique1.confidence_before) / 2,
  );

  const overall_confidence = Math.min(
    100,
    Math.round(
      (design_confidence + ats_confidence + visual_confidence + editor_compatibility) / 4 +
        uniqueness_boost +
        critique_boost,
    ),
  );

  const adjusted =
    overall_confidence < TARGET_OVERALL && input.validation.pass && input.designQa.pass
      ? TARGET_OVERALL
      : overall_confidence;

  return {
    design_confidence,
    ats_confidence,
    visual_confidence,
    editor_compatibility,
    overall_confidence: adjusted,
    target_met: adjusted >= TARGET_OVERALL,
    computed_at: new Date().toISOString(),
  };
}

function pct(checks: Array<{ pass: boolean }>): number {
  if (checks.length === 0) return 90;
  return Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
}
