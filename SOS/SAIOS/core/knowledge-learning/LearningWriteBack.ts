/**
 * Learning write-back from founder decisions — Agent #125.
 */
import { buildLearningEntries } from "./LearningEntryBuilder.js";
import { LearningRepository } from "./LearningRepository.js";
import { persistLearningSnapshot } from "./LearningSnapshotBuilder.js";
import {
  appendDecisionEvents,
  buildDecisionEvent,
} from "../founder-decisions/DecisionEventBuilder.js";
import type { FounderDecision } from "../founder-decisions/types.js";
import type { LearningEntry } from "./types.js";

export class LearningWriteBack {
  constructor(private readonly repo = new LearningRepository()) {}

  writeFromDecision(decision: FounderDecision): LearningEntry[] {
    const entries = buildLearningEntries(decision);
    this.repo.appendMany(entries);
    persistLearningSnapshot(this.repo.list());
    for (const e of entries) {
      appendDecisionEvents([
        buildDecisionEvent(
          "LEARNING_ENTRY_CREATED",
          `Learning ${e.category}: ${e.subject}`,
          {
            decision_id: decision.decision_id,
            review_id: decision.review_id,
            learning_id: e.learning_id,
          },
        ),
      ]);
    }
    return entries;
  }
}
