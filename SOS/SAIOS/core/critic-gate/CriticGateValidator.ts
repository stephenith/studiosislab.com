/**
 * CriticGateValidator — threshold enforcement.
 */
import { GATE_THRESHOLDS, type CriticGateResult, type CriticScoresSnapshot } from "./types.js";

export function validateScoresForGate(scores: CriticScoresSnapshot): {
  ready: boolean;
  blocking_reasons: string[];
  warnings: string[];
  failed_rules: string[];
} {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  const failed_rules: string[] = [];

  if (scores.overall < GATE_THRESHOLDS.overall_min) {
    blocking_reasons.push(
      `Overall ${scores.overall} < ${GATE_THRESHOLDS.overall_min}`,
    );
    failed_rules.push("overall_min");
  }
  if (scores.ats < GATE_THRESHOLDS.ats_min) {
    blocking_reasons.push(`ATS ${scores.ats} < ${GATE_THRESHOLDS.ats_min}`);
    failed_rules.push("ats_min");
  }
  if (scores.technical !== GATE_THRESHOLDS.technical_required) {
    blocking_reasons.push(
      `Technical ${scores.technical} ≠ ${GATE_THRESHOLDS.technical_required}`,
    );
    failed_rules.push("technical_required");
  }
  if (scores.ready === false && scores.blocked_reasons?.length) {
    for (const r of scores.blocked_reasons) {
      if (!blocking_reasons.includes(r)) blocking_reasons.push(r);
    }
  }
  // Critic may mark ready=false even if numeric thresholds somehow pass
  if (scores.ready === false && blocking_reasons.length === 0) {
    blocking_reasons.push("Critic readiness ready=false");
    failed_rules.push("critic_ready_flag");
  }

  if (scores.visual < 85) warnings.push(`Visual score ${scores.visual} soft warn`);
  if (scores.typography < 85) {
    warnings.push(`Typography score ${scores.typography} soft warn`);
  }

  const ready = blocking_reasons.length === 0;
  return { ready, blocking_reasons, warnings, failed_rules };
}

export function assertGateIntegrity(gate: CriticGateResult): string[] {
  const errors: string[] = [];
  if (gate.publication_allowed !== false) {
    errors.push("publication_allowed must be false");
  }
  if (gate.dry_run !== true) errors.push("dry_run must be true");
  if (gate.ready && !gate.founder_review_allowed) {
    errors.push("ready=YES requires founder_review_allowed");
  }
  if (!gate.ready && gate.founder_review_allowed) {
    errors.push("ready=NO forbids founder_review_allowed");
  }
  if (!gate.critic_report_reference) {
    errors.push("critic_report_reference required");
  }
  return errors;
}
