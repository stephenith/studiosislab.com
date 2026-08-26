/**
 * ReadinessGate — blocks Founder Review when quality rules fail.
 */
import type {
  CategoryReport,
  CriticCategory,
  CriticScores,
  ReadinessResult,
} from "./types.js";

export const READINESS_RULES = {
  overall_min: 90,
  ats_min: 95,
  technical_required: 100,
} as const;

export function evaluateReadiness(input: {
  scores: CriticScores;
  reports: Record<CriticCategory, CategoryReport>;
  overflow: boolean;
}): ReadinessResult {
  const blocked: string[] = [];

  if (input.scores.overall < READINESS_RULES.overall_min) {
    blocked.push(
      `Overall ${input.scores.overall} < ${READINESS_RULES.overall_min}`,
    );
  }
  if (input.scores.ats < READINESS_RULES.ats_min) {
    blocked.push(`ATS ${input.scores.ats} < ${READINESS_RULES.ats_min}`);
  }
  if (input.scores.technical !== READINESS_RULES.technical_required) {
    blocked.push(
      `Technical ${input.scores.technical} ≠ ${READINESS_RULES.technical_required}`,
    );
  }
  if (input.overflow) {
    blocked.push("Overflow detected");
  }

  const schemaMismatch = input.reports.technical.findings.some(
    (f) => f.code === "TECH_SCHEMA_MISMATCH" || f.code === "TECH_SCHEMA_VERSION",
  );
  if (schemaMismatch) {
    blocked.push("Schema mismatch");
  }

  const missingSections = input.reports.sections.findings.some(
    (f) => f.code === "SEC_MISSING",
  );
  if (missingSections) {
    blocked.push("Missing required sections");
  }

  const rendererErrors = input.reports.technical.findings.some(
    (f) => f.code === "TECH_RENDERER_ERROR",
  );
  if (rendererErrors) {
    blocked.push("Renderer errors");
  }

  const ready = blocked.length === 0;
  return {
    ready,
    founder_review_allowed: ready,
    blocked_reasons: blocked,
    rules: {
      overall_min: READINESS_RULES.overall_min,
      ats_min: READINESS_RULES.ats_min,
      technical_required: READINESS_RULES.technical_required,
      no_overflow: true,
      no_schema_mismatch: true,
      no_missing_sections: true,
      no_renderer_errors: true,
    },
  };
}
