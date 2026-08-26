/**
 * Persists Timeline Department reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TIMELINE_DEPARTMENT_ROOT } from "./TimelineConfig.js";
import type { TimelineDepartmentResult, TimelineEvent, TimelineReminder, TimelineState } from "./types.js";

export function renderTimelineSummary(state: TimelineState): string {
  return [
    "# Timeline Summary",
    "",
    `**Date:** ${state.clock.date} ${state.clock.time} (${state.clock.timezone})`,
    `**Week:** ${state.clock.week} · **Month:** ${state.clock.month} · **Year:** ${state.clock.year}`,
    `**Sprint:** ${state.sprint.label} — day ${state.sprint.day_index}/${state.sprint.length_days}`,
    `**Project age:** ${state.project_age_days} days`,
    "",
    `Latest agent: #${state.latest_agent}`,
    `Latest founder review: ${state.latest_founder_review}`,
    `Latest release: ${state.latest_release}`,
    `Latest publication: ${state.latest_publication}`,
    "",
    `Templates generated: ${state.templates_generated ?? "n/a"}`,
    `Templates published: ${state.templates_published ?? "n/a"}`,
    `Templates ready: ${state.templates_ready ?? "n/a"}`,
    `Pending founder reviews: ${state.pending_founder_reviews.length}`,
    `Pending publication: ${state.pending_publication}`,
    `Overdue tasks: ${state.overdue_tasks.length}`,
    `Blocked tasks: ${state.blocked_tasks.length}`,
    "",
  ].join("\n");
}

export function renderTimelineHistory(events: TimelineEvent[]): string {
  const byDate = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const lines = ["# Timeline History", ""];
  for (const date of [...byDate.keys()].sort()) {
    lines.push(`## ${date}`, "");
    for (const e of byDate.get(date)!) {
      lines.push(`- **${e.title}** — ${e.summary}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderTimelineReport(result: TimelineDepartmentResult): string {
  return [
    "# Timeline Department Report",
    "",
    `**Generated:** ${result.generated_at}`,
    `**Status:** ${result.status}`,
    "",
    renderTimelineSummary(result.state),
    "## Reminders",
    "",
    ...(result.reminders.length
      ? result.reminders.map((r) => `- [${r.kind}] ${r.title}: ${r.message}`)
      : ["- None"]),
    "",
    "## Upcoming milestones",
    "",
    ...result.state.milestones
      .filter((m) => m.status === "upcoming")
      .map((m) => `- ${m.title}`),
    "",
    "## Checks",
    "",
    ...Object.entries(result.checks).map(([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`),
    "",
  ].join("\n");
}

export function persistTimelineReports(
  state: TimelineState,
  events: TimelineEvent[],
  reminders: TimelineReminder[],
  result: TimelineDepartmentResult,
): string[] {
  mkdirSync(TIMELINE_DEPARTMENT_ROOT, { recursive: true });
  const files = {
    state: join(TIMELINE_DEPARTMENT_ROOT, "timeline-state.json"),
    events: join(TIMELINE_DEPARTMENT_ROOT, "timeline-events.json"),
    reminders: join(TIMELINE_DEPARTMENT_ROOT, "timeline-reminders.json"),
    summary: join(TIMELINE_DEPARTMENT_ROOT, "timeline-summary.md"),
    history: join(TIMELINE_DEPARTMENT_ROOT, "timeline-history.md"),
    dashboard: join(TIMELINE_DEPARTMENT_ROOT, "timeline-dashboard.json"),
    report: join(TIMELINE_DEPARTMENT_ROOT, "timeline-report.md"),
  };

  writeFileSync(files.state, JSON.stringify(state, null, 2));
  writeFileSync(files.events, JSON.stringify({ generated_at: state.generated_at, events }, null, 2));
  writeFileSync(
    files.reminders,
    JSON.stringify({ generated_at: state.generated_at, reminders }, null, 2),
  );
  writeFileSync(files.summary, renderTimelineSummary(state));
  writeFileSync(files.history, renderTimelineHistory(events));
  writeFileSync(
    files.dashboard,
    JSON.stringify(
      {
        generated_at: state.generated_at,
        date: state.clock.date,
        sprint: state.sprint,
        overdue: state.overdue_tasks.length,
        pending: state.pending_work.length,
        reminders: reminders.length,
        milestones_completed: state.milestones.filter((m) => m.status === "completed").length,
        milestones_upcoming: state.milestones.filter((m) => m.status === "upcoming").length,
      },
      null,
      2,
    ),
  );
  writeFileSync(files.report, renderTimelineReport(result));
  return Object.values(files);
}
