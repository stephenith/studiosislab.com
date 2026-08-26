/**
 * Builds timeline reminders for Notification Department consumption.
 */
import type { TimelineReminder, TimelineState } from "./types.js";

export function buildTimelineReminders(state: TimelineState): TimelineReminder[] {
  const now = state.clock.now_iso;
  const reminders: TimelineReminder[] = [];

  for (const dl of state.deadlines) {
    if (dl.status === "overdue") {
      reminders.push({
        id: `rem-overdue-${dl.id}`,
        kind: "OVERDUE",
        title: `Overdue: ${dl.title}`,
        message: `Due ${dl.due_date} (${Math.abs(dl.days_until)} day(s) overdue)`,
        related_ref: dl.source,
        created_at: now,
      });
      reminders.push({
        id: `rem-critical-${dl.id}`,
        kind: "CRITICAL",
        title: `Critical timeline item: ${dl.title}`,
        message: `SLA breached — ${dl.title}`,
        related_ref: dl.source,
        created_at: now,
      });
    } else if (dl.status === "due_today") {
      reminders.push({
        id: `rem-today-${dl.id}`,
        kind: "TODAY",
        title: `Due today: ${dl.title}`,
        message: `Deadline is today (${dl.due_date})`,
        related_ref: dl.source,
        created_at: now,
      });
    } else if (dl.days_until > 0 && dl.days_until <= 7) {
      reminders.push({
        id: `rem-week-${dl.id}`,
        kind: "THIS_WEEK",
        title: `This week: ${dl.title}`,
        message: `Due ${dl.due_date} (in ${dl.days_until} day(s))`,
        related_ref: dl.source,
        created_at: now,
      });
    } else if (dl.days_until > 7) {
      reminders.push({
        id: `rem-up-${dl.id}`,
        kind: "UPCOMING",
        title: `Upcoming: ${dl.title}`,
        message: `Due ${dl.due_date}`,
        related_ref: dl.source,
        created_at: now,
      });
    }
  }

  for (const ms of state.milestones.filter((m) => m.status === "upcoming")) {
    reminders.push({
      id: `rem-ms-${ms.id}`,
      kind: "UPCOMING",
      title: `Upcoming milestone: ${ms.title}`,
      message: ms.evidence ?? ms.title,
      related_ref: ms.id,
      created_at: now,
    });
  }

  if (state.pending_founder_reviews.length > 0) {
    reminders.push({
      id: "rem-founder-today",
      kind: "TODAY",
      title: "Pending founder review needs attention",
      message: state.pending_founder_reviews.join("; "),
      related_ref: state.latest_founder_review,
      created_at: now,
    });
  }

  return reminders;
}
