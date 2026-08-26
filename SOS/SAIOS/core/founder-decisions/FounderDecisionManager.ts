/**
 * Founder Decision Manager — Agent #125.
 */
import { createFounderDecision } from "./FounderDecision.js";
import { FounderReviewRepository } from "./FounderReviewRepository.js";
import { FounderActionQueueUpdater } from "./FounderActionQueueUpdater.js";
import {
  appendDecisionEvents,
  eventsForDecision,
  buildDecisionEvent,
} from "./DecisionEventBuilder.js";
import { DecisionReporter } from "./DecisionReporter.js";
import { LearningWriteBack } from "../knowledge-learning/LearningWriteBack.js";
import { writeFounderPreferenceMemorySafe } from "../founder-memory/FounderPreferenceWriter.js";
import type { DecisionInput, FounderDecision } from "./types.js";
import type { LearningEntry } from "../knowledge-learning/types.js";

export type RecordDecisionResult = {
  decision: FounderDecision;
  events_written: number;
  queue: { resolved_id: string; added_id: string };
  learning: LearningEntry[];
};

export class FounderDecisionManager {
  constructor(
    private readonly repo = new FounderReviewRepository(),
    private readonly queue = new FounderActionQueueUpdater(),
    private readonly reporter = new DecisionReporter(),
    private readonly learning = new LearningWriteBack(),
    private readonly repoRoot?: string,
  ) {}

  openReview(reviewId: string): void {
    appendDecisionEvents([
      buildDecisionEvent("FOUNDER_REVIEW_OPENED", `Opened review ${reviewId}`, {
        review_id: reviewId,
      }),
    ]);
  }

  recordDecision(input: DecisionInput): RecordDecisionResult {
    const decision = createFounderDecision(input);
    this.repo.append(decision);
    const events = eventsForDecision(decision);
    appendDecisionEvents(events);
    const queue = this.queue.applyDecision(decision);
    // Fixture decisions must not pollute real founder-approved learning
    const learning = decision.fixture
      ? []
      : this.learning.writeFromDecision(decision);
    this.reporter.writeMarkdown(this.repo.list(false));
    // Supplemental Founder preference memory — fail-open; never fail the decision.
    if (!decision.fixture) {
      try {
        writeFounderPreferenceMemorySafe(decision, this.repoRoot);
      } catch {
        // intentionally swallowed
      }
    }
    return { decision, events_written: events.length, queue, learning };
  }

  listReal(): FounderDecision[] {
    return this.repo.list(false);
  }

  listFixtures(): FounderDecision[] {
    return this.repo.list(true);
  }
}
