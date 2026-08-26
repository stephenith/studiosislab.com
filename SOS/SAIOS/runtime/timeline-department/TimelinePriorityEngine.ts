/**
 * Lightweight priority ranking for timeline items.
 */
import type { Deadline, TimelineReminder } from "./types.js";

const KIND_ORDER: Record<TimelineReminder["kind"], number> = {
  CRITICAL: 0,
  OVERDUE: 1,
  TODAY: 2,
  THIS_WEEK: 3,
  UPCOMING: 4,
};

export function prioritizeReminders(reminders: TimelineReminder[]): TimelineReminder[] {
  return [...reminders].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

export function prioritizeDeadlines(deadlines: Deadline[]): Deadline[] {
  const order: Record<Deadline["status"], number> = {
    overdue: 0,
    due_today: 1,
    blocked: 2,
    upcoming: 3,
  };
  return [...deadlines].sort((a, b) => order[a.status] - order[b.status] || a.days_until - b.days_until);
}
