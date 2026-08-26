/**
 * Pending work from project-state and dashboards.
 */
import type { PendingWorkItem } from "./types.js";

export function buildPendingWork(input: {
  pendingActions: string[];
  readyToPublish: number;
  waitingFounder: number;
  catalogConflicts: number;
  history: Array<{ at: string; type: string; summary: string }>;
}): PendingWorkItem[] {
  const items: PendingWorkItem[] = [];

  for (const [i, action] of input.pendingActions.entries()) {
    const lower = action.toLowerCase();
    let category: PendingWorkItem["category"] = "other";
    if (lower.includes("founder")) category = "founder_review";
    else if (lower.includes("publish") || lower.includes("publication")) category = "publication";
    else if (lower.includes("rollback") || lower.includes("release")) category = "release";

    const related = input.history.find((h) =>
      lower.includes("founder")
        ? h.type === "founder_review"
        : lower.includes("publish")
          ? h.type.includes("publication") || h.type.includes("batch_release")
          : false,
    );

    items.push({
      id: `pending-${i}`,
      title: action,
      category,
      status: category === "founder_review" ? "pending" : "pending",
      since: related?.at ?? null,
      source: "project-state.pending_actions",
    });
  }

  if (input.readyToPublish > 0 && !items.some((i) => i.category === "publication")) {
    items.push({
      id: "pending-ready-publish",
      title: `${input.readyToPublish} template(s) ready to publish`,
      category: "publication",
      status: "pending",
      since: null,
      source: "production-dashboard",
    });
  }

  if (input.catalogConflicts > 0) {
    items.push({
      id: "pending-catalog-conflict",
      title: `${input.catalogConflicts} catalog integrity conflict(s)`,
      category: "integrity",
      status: "blocked",
      since: null,
      source: "catalog-integrity",
    });
  }

  return items;
}
