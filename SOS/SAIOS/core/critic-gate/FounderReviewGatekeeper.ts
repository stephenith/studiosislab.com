/**
 * FounderReviewGatekeeper — blocks Founder Review creation without Ready=YES.
 * Does not mutate historical dry-run review artifacts.
 */
import type { CriticGateResult } from "./types.js";
import { GATE_THRESHOLDS } from "./types.js";

export type ReviewCreateRequest = {
  review_id: string;
  task_id: string;
  candidate_id: string;
  gate: CriticGateResult | null;
};

export type ReviewCreateDecision = {
  allowed: boolean;
  reason: string;
  require_critic_report: true;
  publication_allowed: false;
};

export class FounderReviewGatekeeper {
  canCreateReview(req: ReviewCreateRequest): ReviewCreateDecision {
    if (!req.gate) {
      return {
        allowed: false,
        reason: "Missing Critic Gate Result — founder review forbidden",
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (!req.gate.critic_report_reference) {
      return {
        allowed: false,
        reason: "Missing critic report reference",
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (!req.gate.ready || !req.gate.founder_review_allowed) {
      return {
        allowed: false,
        reason: `Ready=NO — ${req.gate.blocking_reasons.join("; ") || "blocked"}`,
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (req.gate.technical_score !== GATE_THRESHOLDS.technical_required) {
      return {
        allowed: false,
        reason: `Technical ${req.gate.technical_score} ≠ ${GATE_THRESHOLDS.technical_required}`,
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (req.gate.ats_score < GATE_THRESHOLDS.ats_min) {
      return {
        allowed: false,
        reason: `ATS ${req.gate.ats_score} < ${GATE_THRESHOLDS.ats_min}`,
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (req.gate.overall_score < GATE_THRESHOLDS.overall_min) {
      return {
        allowed: false,
        reason: `Overall ${req.gate.overall_score} < ${GATE_THRESHOLDS.overall_min}`,
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (req.gate.publication_allowed !== false) {
      return {
        allowed: false,
        reason: "publication_allowed must remain false",
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    return {
      allowed: true,
      reason: "Critic Gate Ready=YES — founder review permitted (no auto-publish)",
      require_critic_report: true,
      publication_allowed: false,
    };
  }

  /** Decision actions require an existing review that was gate-allowed. */
  canSubmitFounderDecision(gate: CriticGateResult | null): ReviewCreateDecision {
    if (!gate) {
      return {
        allowed: false,
        reason: "No Critic Gate for this candidate",
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    if (!gate.ready) {
      return {
        allowed: false,
        reason: "Approve/Reject/Request Changes blocked — Critic Ready=NO",
        require_critic_report: true,
        publication_allowed: false,
      };
    }
    return this.canCreateReview({
      review_id: gate.candidate_id,
      task_id: gate.task_id,
      candidate_id: gate.candidate_id,
      gate,
    });
  }
}
