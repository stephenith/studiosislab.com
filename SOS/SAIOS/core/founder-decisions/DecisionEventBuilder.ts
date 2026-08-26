/**
 * Decision / learning event builder — Agent #125.
 */
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DecisionEvent, DecisionEventType, FounderDecision } from "./types.js";

export function buildDecisionEvent(
  type: DecisionEventType,
  summary: string,
  extra: Partial<DecisionEvent> = {},
): DecisionEvent {
  return {
    event_id: `evt-${randomUUID().slice(0, 10)}`,
    type,
    at: new Date().toISOString(),
    summary,
    dry_run: true,
    ...extra,
  };
}

export function eventsForDecision(decision: FounderDecision): DecisionEvent[] {
  const events: DecisionEvent[] = [];
  if (decision.decision === "APPROVED") {
    events.push(
      buildDecisionEvent("FOUNDER_DECISION_APPROVED", `Approved ${decision.review_id}`, {
        decision_id: decision.decision_id,
        review_id: decision.review_id,
      }),
    );
  } else if (decision.decision === "REJECTED") {
    events.push(
      buildDecisionEvent("FOUNDER_DECISION_REJECTED", `Rejected ${decision.review_id}`, {
        decision_id: decision.decision_id,
        review_id: decision.review_id,
      }),
    );
  } else {
    events.push(
      buildDecisionEvent(
        "FOUNDER_CHANGES_REQUESTED",
        `Changes requested on ${decision.review_id}`,
        { decision_id: decision.decision_id, review_id: decision.review_id },
      ),
      buildDecisionEvent(
        "REVISION_TASK_PROPOSED",
        `Revision proposed for ${decision.task_id}`,
        { decision_id: decision.decision_id, review_id: decision.review_id },
      ),
    );
  }
  events.push(
    buildDecisionEvent("FOUNDER_ACTION_RESOLVED", `Action resolved for ${decision.review_id}`, {
      decision_id: decision.decision_id,
      review_id: decision.review_id,
    }),
  );
  return events;
}

export function appendDecisionEvents(
  events: DecisionEvent[],
  repoRoot?: string,
): string {
  const repo = repoRoot ?? resolve(import.meta.dirname, "../../../..");
  const dir = join(repo, "SOS/07_LOGS/saios/founder-decisions");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "events.jsonl");
  for (const e of events) {
    appendFileSync(path, `${JSON.stringify(e)}\n`);
  }
  // Also append to event-bus history if present as jsonl
  const bus = join(repo, "SOS/07_LOGS/saios/event-bus/events.jsonl");
  if (existsSync(join(repo, "SOS/07_LOGS/saios/event-bus"))) {
    mkdirSync(join(repo, "SOS/07_LOGS/saios/event-bus"), { recursive: true });
    for (const e of events) {
      appendFileSync(bus, `${JSON.stringify({ ...e, bus: "founder-decisions" })}\n`);
    }
  }
  return path;
}
