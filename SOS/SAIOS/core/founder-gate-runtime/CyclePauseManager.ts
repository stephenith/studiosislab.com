/**
 * CyclePauseManager — persist WAITING_FOUNDER checkpoints.
 */
import { withChecksum } from "./CycleCheckpoint.js";
import { assertTransition } from "./CycleStateMachine.js";
import { WaitingFounderRepository } from "./WaitingFounderRepository.js";
import type { CycleCheckpoint, CycleState } from "./types.js";

export type PauseInput = {
  cycle_id: string;
  task_id: string;
  candidate_id: string;
  candidate_title: string;
  review_id: string;
  completed_stages: string[];
  artifact_references: Record<string, string>;
  critic_result: CycleCheckpoint["critic_result"];
  queue_action_id: string | null;
  from_state?: CycleState;
  fixture?: boolean;
};

export class CyclePauseManager {
  constructor(private readonly repo = new WaitingFounderRepository()) {}

  pauseForFounder(input: PauseInput): CycleCheckpoint {
    const from = input.from_state ?? "CRITIC_EVALUATION";
    assertTransition(from, "WAITING_FOUNDER");

    // Prevent duplicate waiting reviews for same cycle
    const existing = this.repo.latestForCycle(input.cycle_id);
    if (existing?.state === "WAITING_FOUNDER") {
      return existing;
    }

    const now = new Date().toISOString();
    const base = {
      cycle_id: input.cycle_id,
      task_id: input.task_id,
      candidate_id: input.candidate_id,
      candidate_title: input.candidate_title,
      review_id: input.review_id,
      state: "WAITING_FOUNDER" as const,
      completed_stages: input.completed_stages,
      artifact_references: input.artifact_references,
      critic_result: input.critic_result,
      queue_action_id: input.queue_action_id,
      created_at: existing?.created_at ?? now,
      last_updated_at: now,
      dry_run: true as const,
      publication_allowed: false as const,
      fixture: input.fixture,
    };
    const cp = withChecksum(base);
    this.repo.appendWaiting(cp);
    this.repo.appendTransition({
      cycle_id: input.cycle_id,
      from,
      to: "WAITING_FOUNDER",
      at: now,
      reason: "Paused for interactive founder decision",
      fixture: input.fixture,
    });
    this.repo.appendActivity({
      event_type: "CYCLE_PAUSED_FOR_FOUNDER",
      cycle_id: input.cycle_id,
      summary: `Paused at WAITING_FOUNDER · review ${input.review_id}`,
      status: "waiting_founder",
      at: now,
      fixture: input.fixture,
    });
    return cp;
  }

  recoverWaiting(): CycleCheckpoint[] {
    const waiting = this.repo.activeWaiting(true);
    for (const w of waiting) {
      this.repo.appendRecovery({
        at: new Date().toISOString(),
        event: "RECOVERED_WAITING_FOUNDER",
        cycle_id: w.cycle_id,
        review_id: w.review_id,
        checksum_ok: true,
      });
    }
    this.repo.rebuildSnapshots();
    return waiting;
  }
}
