/**
 * CycleResumeManager — resume after validated founder decision + learning.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FounderDecisionManager } from "../founder-decisions/FounderDecisionManager.js";
import { buildLearningEntries } from "../knowledge-learning/LearningEntryBuilder.js";
import { withChecksum } from "./CycleCheckpoint.js";
import {
  assertTransition,
  decisionToState,
  terminalAfterLearning,
} from "./CycleStateMachine.js";
import { validateDecisionForCycle } from "./FounderGateValidator.js";
import { WaitingFounderRepository } from "./WaitingFounderRepository.js";
import type {
  CycleCheckpoint,
  DecisionConsumption,
  FounderDecisionKind,
  ResumeResult,
} from "./types.js";

export type ResumeInput = {
  cycle_id: string;
  decision_id: string;
  review_id: string;
  task_id: string;
  decision: FounderDecisionKind;
  founder_actor: string;
  reason: string;
  requested_changes?: string[];
  /** When true, decision already recorded — only consume + resume */
  decision_already_recorded?: boolean;
  fixture?: boolean;
};

export class CycleResumeManager {
  constructor(
    private readonly repo = new WaitingFounderRepository(),
    private readonly decisions = new FounderDecisionManager(),
  ) {}

  resume(input: ResumeInput): ResumeResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return {
        ok: false,
        cycle_id: input.cycle_id,
        state: "FAILED",
        learning_count: 0,
        next_action: null,
        error: "LIVE must be OFF",
      };
    }

    const checkpoint = this.repo.latestForCycle(input.cycle_id);
    if (!checkpoint) {
      return {
        ok: false,
        cycle_id: input.cycle_id,
        state: "FAILED",
        learning_count: 0,
        next_action: null,
        error: "checkpoint not found",
      };
    }

    if (this.repo.isDecisionConsumed(input.decision_id)) {
      return {
        ok: true,
        cycle_id: input.cycle_id,
        state: checkpoint.state,
        learning_count: 0,
        next_action: null,
        duplicate: true,
      };
    }

    const decisionLike = {
      decision_id: input.decision_id,
      review_id: input.review_id,
      task_id: input.task_id,
      cycle_id: input.cycle_id,
      decision: input.decision,
      founder_actor: input.founder_actor,
      publication_allowed: false,
      dry_run: true,
    };

    const v = validateDecisionForCycle(decisionLike, checkpoint);
    if (!v.ok) {
      return {
        ok: false,
        cycle_id: input.cycle_id,
        state: checkpoint.state,
        learning_count: 0,
        next_action: null,
        error: v.errors.join("; "),
      };
    }

    let learning_count = 0;
    let next_action: string | null = null;
    let decision_id = input.decision_id;

    if (!input.decision_already_recorded) {
      if (input.fixture) {
        const recorded = this.decisions.recordDecision({
          review_id: input.review_id,
          task_id: input.task_id,
          cycle_id: input.cycle_id,
          decision: input.decision,
          founder_actor: input.founder_actor,
          reason: input.reason,
          requested_changes: input.requested_changes,
          fixture: true,
        });
        decision_id = recorded.decision.decision_id;
        // Isolate fixture learning from real knowledge store
        const entries = buildLearningEntries({
          ...recorded.decision,
          fixture: false,
        }).map((e) => ({ ...e, fixture: true as const }));
        const fxDir = join(
          resolve(import.meta.dirname, "../../../.."),
          "SOS/07_LOGS/saios/founder-gate-runtime/fixtures",
        );
        mkdirSync(fxDir, { recursive: true });
        for (const e of entries) {
          appendFileSync(
            join(fxDir, "learning-entries.jsonl"),
            `${JSON.stringify(e)}\n`,
          );
        }
        learning_count = entries.length;
        next_action = recorded.decision.next_action;
      } else {
        const recorded = this.decisions.recordDecision({
          review_id: input.review_id,
          task_id: input.task_id,
          cycle_id: input.cycle_id,
          decision: input.decision,
          founder_actor: input.founder_actor,
          reason: input.reason,
          requested_changes: input.requested_changes,
          fixture: false,
        });
        decision_id = recorded.decision.decision_id;
        learning_count = recorded.learning.length;
        next_action = recorded.decision.next_action;
      }
    } else {
      // Learning already written by FounderDecisionManager at API time —
      // count from learning file for this decision if present
      learning_count = this.countLearningForDecision(decision_id);
      next_action = this.nextActionFor(input.decision);
    }

    const now = new Date().toISOString();
    const decidedState = decisionToState(input.decision);
    assertTransition("WAITING_FOUNDER", decidedState);

    this.repo.appendTransition({
      cycle_id: input.cycle_id,
      from: "WAITING_FOUNDER",
      to: decidedState,
      at: now,
      reason: `Founder ${input.decision}`,
      fixture: input.fixture,
    });

    assertTransition(decidedState, "LEARNING_WRITEBACK");
    this.repo.appendTransition({
      cycle_id: input.cycle_id,
      from: decidedState,
      to: "LEARNING_WRITEBACK",
      at: now,
      reason: "Learning write-back",
      fixture: input.fixture,
    });

    const terminal = terminalAfterLearning(decidedState);
    assertTransition("LEARNING_WRITEBACK", terminal);
    this.repo.appendTransition({
      cycle_id: input.cycle_id,
      from: "LEARNING_WRITEBACK",
      to: terminal,
      at: now,
      reason: "Cycle complete",
      fixture: input.fixture,
    });

    const consumption: DecisionConsumption = {
      consumption_id: `cons-${randomUUID().slice(0, 10)}`,
      decision_id,
      cycle_id: input.cycle_id,
      review_id: input.review_id,
      decision: input.decision,
      consumed_at: now,
      fixture: input.fixture,
    };
    this.repo.appendConsumption(consumption);

    this.repo.appendActivity({
      event_type: "FOUNDER_DECISION_RECORDED",
      cycle_id: input.cycle_id,
      summary: `${input.decision} · ${decision_id}`,
      at: now,
      fixture: input.fixture,
    });
    this.repo.appendActivity({
      event_type: "CYCLE_RESUMED",
      cycle_id: input.cycle_id,
      summary: `Resumed from WAITING_FOUNDER → ${decidedState}`,
      at: now,
      fixture: input.fixture,
    });
    this.repo.appendActivity({
      event_type: "LEARNING_WRITEBACK_COMPLETED",
      cycle_id: input.cycle_id,
      summary: `Learning entries: ${learning_count}`,
      at: now,
      fixture: input.fixture,
    });
    this.repo.appendActivity({
      event_type: "CYCLE_COMPLETED",
      cycle_id: input.cycle_id,
      summary: `Terminal state ${terminal} · publication_allowed=false`,
      at: now,
      fixture: input.fixture,
    });

    const updated: CycleCheckpoint = withChecksum({
      ...checkpoint,
      state: terminal,
      last_updated_at: now,
      fixture: input.fixture,
    });
    this.repo.appendWaiting(updated);

    this.writeCycleCompleteArtifact(updated, input.decision, decision_id, learning_count, next_action);

    return {
      ok: true,
      cycle_id: input.cycle_id,
      state: terminal,
      learning_count,
      next_action,
    };
  }

  private nextActionFor(d: FounderDecisionKind): string {
    if (d === "APPROVED") return "Prepare resume template for real-provider validation";
    if (d === "REJECTED") return "Review rejected-pattern learning";
    return "Prepare revision task from founder feedback";
  }

  private countLearningForDecision(decisionId: string): number {
    const path = join(
      resolve(import.meta.dirname, "../../../.."),
      "SOS/07_LOGS/saios/knowledge/learning/learning-entries.jsonl",
    );
    if (!existsSync(path)) return 0;
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { source_decision_id?: string })
      .filter((e) => e.source_decision_id === decisionId).length;
  }

  private writeCycleCompleteArtifact(
    cp: CycleCheckpoint,
    decision: FounderDecisionKind,
    decision_id: string,
    learning_count: number,
    next_action: string | null,
  ): void {
    if (cp.fixture) {
      const dir = join(
        resolve(import.meta.dirname, "../../../.."),
        "SOS/07_LOGS/saios/founder-gate-runtime/fixtures",
      );
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `cycle-complete-${cp.cycle_id}.json`),
        `${JSON.stringify(
          {
            cycle_id: cp.cycle_id,
            state: cp.state,
            decision,
            decision_id,
            learning_count,
            next_action,
            publication_allowed: false,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    const dir = join(
      resolve(import.meta.dirname, "../../../.."),
      "SOS/07_LOGS/saios/first-production-cycle",
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "cycle-resume.json"),
      `${JSON.stringify(
        {
          cycle_id: cp.cycle_id,
          state: cp.state,
          decision,
          decision_id,
          learning_count,
          next_action,
          publication_allowed: false,
          resumed_at: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(dir, "review.json"),
      `${JSON.stringify(
        {
          review_id: cp.review_id,
          task_id: cp.task_id,
          cycle_id: cp.cycle_id,
          candidate_id: cp.candidate_id,
          status: "decided",
          decision,
          decision_id,
          publication_allowed: false,
          auto_decision: false,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(dir, "dashboard.json"),
      `${JSON.stringify(
        {
          current_stage: cp.state,
          current_candidate: cp.candidate_title,
          current_duration_ms: null,
          current_queue: cp.queue_action_id,
          critic_score: cp.critic_result
            ? {
                overall: cp.critic_result.overall,
                ats: cp.critic_result.ats,
                ready: cp.critic_result.ready,
              }
            : null,
          founder_waiting: false,
          completed_cycle: true,
          recent_learning: learning_count,
          task_id: cp.task_id,
          cycle_id: cp.cycle_id,
          review_id: cp.review_id,
          paused: false,
          next_action,
          waiting_banner: null,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(dir, "learning.json"),
      `${JSON.stringify(
        {
          learning_count,
          deferred: false,
          decision_id,
          written_after: "interactive_founder_decision",
        },
        null,
        2,
      )}\n`,
    );
  }
}
