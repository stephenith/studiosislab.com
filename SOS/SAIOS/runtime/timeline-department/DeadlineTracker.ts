/**
 * Deadline tracker — SLA-based overdue detection for pending work.
 */
import { daysBetween } from "./TimelineClock.js";
import type { ClockState, Deadline, PendingWorkItem } from "./types.js";

export function buildDeadlines(input: {
  clock: ClockState;
  pending: PendingWorkItem[];
  founderReviewSlaDays: number;
  publicationSlaDays: number;
}): Deadline[] {
  const deadlines: Deadline[] = [];

  for (const item of input.pending) {
    const since = item.since?.slice(0, 10) ?? input.clock.date;
    const sla =
      item.category === "founder_review"
        ? input.founderReviewSlaDays
        : item.category === "publication"
          ? input.publicationSlaDays
          : 5;
    const due = addDaysLocal(since, sla);
    const daysUntil = daysBetween(input.clock.date, due);
    let status: Deadline["status"] = "upcoming";
    if (daysUntil < 0) status = "overdue";
    else if (daysUntil === 0) status = "due_today";
    if (item.status === "blocked") status = "blocked";

    deadlines.push({
      id: `dl-${item.id}`,
      title: item.title,
      due_date: due,
      status,
      days_until: daysUntil,
      source: item.source,
    });
  }

  return deadlines;
}

function addDaysLocal(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
