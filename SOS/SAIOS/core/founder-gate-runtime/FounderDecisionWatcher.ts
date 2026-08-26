/**
 * FounderDecisionWatcher — consume immutable decisions for waiting cycles.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CycleResumeManager } from "./CycleResumeManager.js";
import { WaitingFounderRepository } from "./WaitingFounderRepository.js";
import type { FounderDecisionKind, ResumeResult } from "./types.js";
import { FOUNDER_ACTOR } from "./types.js";

export type WatchedDecision = {
  decision_id: string;
  review_id: string;
  task_id: string;
  cycle_id: string;
  decision: FounderDecisionKind;
  founder_actor: string;
  reason: string;
  requested_changes?: string[];
  publication_allowed: false;
  dry_run: true;
};

export class FounderDecisionWatcher {
  constructor(
    private readonly repo = new WaitingFounderRepository(),
    private readonly resumeMgr = new CycleResumeManager(),
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {}

  /**
   * Resume a waiting cycle from an already-recorded founder decision
   * (dashboard API path). Learning is already written — mark consumed only.
   */
  consumeRecordedDecision(decision: WatchedDecision): ResumeResult {
    return this.resumeMgr.resume({
      cycle_id: decision.cycle_id,
      decision_id: decision.decision_id,
      review_id: decision.review_id,
      task_id: decision.task_id,
      decision: decision.decision,
      founder_actor: decision.founder_actor || FOUNDER_ACTOR,
      reason: decision.reason,
      requested_changes: decision.requested_changes,
      decision_already_recorded: true,
      fixture: false,
    });
  }

  findWaitingByReview(reviewId: string) {
    return this.repo
      .activeWaiting(true)
      .find((c) => c.review_id === reviewId);
  }

  loadDecisionFromStore(decisionId: string): WatchedDecision | null {
    const path = join(
      this.repoRoot,
      "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
    );
    if (!existsSync(path)) return null;
    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      const d = JSON.parse(line) as WatchedDecision & { fixture?: boolean };
      if (d.decision_id === decisionId && !d.fixture) return d;
    }
    return null;
  }
}
