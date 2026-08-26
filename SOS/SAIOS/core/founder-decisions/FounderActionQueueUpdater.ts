/**
 * Update founder action queue after decisions — Agent #125.
 * Does not auto-start next actions.
 */
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FounderDecision } from "./types.js";

type Action = {
  id: string;
  priority: string;
  title: string;
  detail: string;
  source: string;
  category?: string;
  task_id?: string;
  status?: string;
  resolved_by?: string;
  resolved_at?: string;
};

export class FounderActionQueueUpdater {
  constructor(
    private readonly queuePath = join(
      resolve(import.meta.dirname, "../../../.."),
      "SOS/07_LOGS/saios/founder-control-center/founder-action-queue.json",
    ),
  ) {}

  applyDecision(decision: FounderDecision): {
    resolved_id: string;
    added_id: string;
  } {
    if (decision.fixture) {
      return { resolved_id: decision.review_id, added_id: "fixture-skip" };
    }

    let doc: {
      generated_at: string;
      recommended_next_action?: string;
      actions: Action[];
    } = { generated_at: new Date().toISOString(), actions: [] };

    if (existsSync(this.queuePath)) {
      doc = JSON.parse(readFileSync(this.queuePath, "utf8"));
    }

    const now = new Date().toISOString();
    doc.actions = doc.actions.map((a) => {
      if (a.id === decision.review_id || a.task_id === decision.task_id) {
        if (a.status === "waiting_founder" || a.category === "founder-approval") {
          return {
            ...a,
            status: "resolved",
            resolved_by: decision.decision_id,
            resolved_at: now,
          };
        }
      }
      return a;
    });

    const nextId = `next-${decision.decision_id}`;
    const nextAction: Action = {
      id: nextId,
      priority: "P1",
      title: decision.next_action,
      detail: `Follow-up from ${decision.decision} on ${decision.review_id}. Not auto-started.`,
      source: "founder-decisions",
      category: "next-safe-action",
      task_id: decision.task_id,
      status: "proposed",
    };

    // Avoid duplicate next actions
    doc.actions = [
      nextAction,
      ...doc.actions.filter((a) => a.id !== nextId),
    ];
    doc.generated_at = now;
    doc.recommended_next_action = decision.next_action;

    const tmp = `${this.queuePath}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
    renameSync(tmp, this.queuePath);

    return { resolved_id: decision.review_id, added_id: nextId };
  }
}
