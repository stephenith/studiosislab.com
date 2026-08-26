/**
 * CriticGate — orchestrates hard gate between Critic and Founder Review.
 */
import { randomUUID } from "node:crypto";
import { CriticResultLoader } from "./CriticResultLoader.js";
import {
  assertGateIntegrity,
  validateScoresForGate,
} from "./CriticGateValidator.js";
import { CriticGateStore } from "./CriticGateStore.js";
import { FounderQueueGatekeeper } from "./FounderQueueGatekeeper.js";
import { FounderReviewGatekeeper } from "./FounderReviewGatekeeper.js";
import {
  appendGateEvents,
  eventsForGate,
} from "./CriticDecisionEventBuilder.js";
import { buildGateReportMarkdown } from "./CriticGateReporter.js";
import { writeProvisionalCriticLearning } from "./ProvisionalCriticLearning.js";
import type {
  BlockedCandidate,
  CriticGateInput,
  CriticGateResult,
  RemediationProposal,
} from "./types.js";

export type CriticGateRunResult = {
  gate: CriticGateResult;
  review_create: ReturnType<FounderReviewGatekeeper["canCreateReview"]>;
  queue: { added_id: string | null; skipped_duplicate: boolean };
  blocked: BlockedCandidate | null;
  remediation: RemediationProposal | null;
  learning_count: number;
};

export class CriticGate {
  constructor(
    private readonly loader = new CriticResultLoader(),
    private readonly store = new CriticGateStore(),
    private readonly queue = new FounderQueueGatekeeper(),
    private readonly reviewGate = new FounderReviewGatekeeper(),
  ) {}

  evaluate(input: CriticGateInput): CriticGateRunResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CriticGate refuses to run while SOS_AIOS_LIVE=1");
    }

    const ref =
      input.critic_report_reference ?? this.loader.defaultReportReference();
    const verdict = validateScoresForGate(input.scores);

    const gate: CriticGateResult = {
      gate_id: `cg-${randomUUID().slice(0, 12)}`,
      task_id: input.task_id,
      cycle_id: input.cycle_id,
      candidate_id: input.candidate_id,
      candidate_title: input.candidate_title,
      critic_report_reference: ref,
      overall_score: input.scores.overall,
      ats_score: input.scores.ats,
      visual_score: input.scores.visual,
      typography_score: input.scores.typography,
      layout_score: input.scores.layout,
      technical_score: input.scores.technical,
      consistency_score: input.scores.consistency,
      section_score: input.scores.sections,
      ready: verdict.ready,
      blocking_reasons: verdict.blocking_reasons,
      warnings: verdict.warnings,
      evaluated_at: new Date().toISOString(),
      dry_run: true,
      founder_review_allowed: verdict.ready,
      publication_allowed: false,
      fixture: input.fixture,
    };

    const integrity = assertGateIntegrity(gate);
    if (integrity.length) {
      throw new Error(`Gate integrity: ${integrity.join("; ")}`);
    }

    this.store.appendGate(gate);
    appendGateEvents(eventsForGate(gate));

    let blocked: BlockedCandidate | null = null;
    let remediation: RemediationProposal | null = null;
    let learning_count = 0;

    if (!gate.ready) {
      blocked = {
        candidate_id: gate.candidate_id,
        task_id: gate.task_id,
        cycle_id: gate.cycle_id,
        candidate_title: gate.candidate_title,
        gate_id: gate.gate_id,
        overall_score: gate.overall_score,
        ats_score: gate.ats_score,
        technical_score: gate.technical_score,
        critic_scores: {
          overall: gate.overall_score,
          ats: gate.ats_score,
          visual: gate.visual_score,
          typography: gate.typography_score,
          layout: gate.layout_score,
          technical: gate.technical_score,
          consistency: gate.consistency_score,
          sections: gate.section_score,
        },
        blocking_reasons: gate.blocking_reasons,
        failed_rules: verdict.failed_rules,
        remediation_recommendation:
          "Address critic blocking reasons, re-render, re-run Resume Critic, then re-gate. Do not auto-execute.",
        created_at: new Date().toISOString(),
        status: "BLOCKED_BY_CRITIC",
        dry_run: true,
        fixture: gate.fixture,
      };
      this.store.appendBlocked(blocked);

      remediation = {
        proposal_id: `rem-${randomUUID().slice(0, 10)}`,
        candidate_id: gate.candidate_id,
        task_id: gate.task_id,
        title: `Resolve critic failure: ${gate.candidate_title}`,
        detail: gate.blocking_reasons.join("; "),
        blocking_reasons: gate.blocking_reasons,
        created_at: new Date().toISOString(),
        status: "proposed",
        auto_execute: false,
        fixture: gate.fixture,
      };
      this.store.appendRemediation(remediation);

      if (!gate.fixture) {
        learning_count = writeProvisionalCriticLearning(gate).length;
      }
    }

    const queue = this.queue.applyGate(gate, remediation);
    this.store.writeReport(buildGateReportMarkdown(this.store.listGates()));

    const review_create = this.reviewGate.canCreateReview({
      review_id: `review-${gate.candidate_id}`,
      task_id: gate.task_id,
      candidate_id: gate.candidate_id,
      gate,
    });

    return {
      gate,
      review_create,
      queue,
      blocked,
      remediation,
      learning_count,
    };
  }

  evaluateFromDisk(partial: {
    task_id: string;
    cycle_id: string;
    candidate_id: string;
    candidate_title: string;
    fixture?: boolean;
  }): CriticGateRunResult {
    const scores = this.loader.loadScores();
    if (!scores) {
      throw new Error("Critic readiness artifacts missing");
    }
    return this.evaluate({
      ...partial,
      scores,
      critic_report_reference: this.loader.defaultReportReference(),
    });
  }
}
