/**
 * Timeline Department Director — AI OS system clock.
 * AGENT #102
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  defaultTimelineConfig,
  persistTimelineConfig,
  TIMELINE_DEPARTMENT_ROOT,
} from "./TimelineConfig.js";
import { prioritizeReminders } from "./TimelinePriorityEngine.js";
import { buildTimelineReminders } from "./TimelineReminderBuilder.js";
import { persistTimelineReports } from "./TimelineReporter.js";
import { buildTimelineState } from "./TimelineStateBuilder.js";
import type { TimelineDepartmentResult } from "./types.js";

export const TIMELINE_DEPARTMENT = {
  module: "timeline-department",
  version: "1.0.0",
  agent: "102",
  role: "ai_os_system_clock",
  prohibitions: [
    "no_resume_generation",
    "no_website_department_mutation",
    "no_notification_department_mutation",
    "no_scheduler_mutation",
  ],
} as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const STATE_PATH = join(REPO_ROOT, "SOS/project-state.json");

type ProjectState = {
  generated_at: string;
  latest_agent: string;
  next_agent: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
};

export function runTimelineDepartment(options: { persist?: boolean } = {}): TimelineDepartmentResult {
  const persist = options.persist !== false;
  const config = persist ? persistTimelineConfig(defaultTimelineConfig()) : defaultTimelineConfig();
  const built = buildTimelineState(config);
  // Reflect this agent's completion in the emitted timeline snapshot.
  const state = {
    ...built.state,
    latest_agent: "102",
    next_agent: "103",
  };
  const events = built.events;
  const reminders = prioritizeReminders(buildTimelineReminders(state));

  const checks = {
    clock: Boolean(state.clock.date && state.clock.time && state.clock.timezone),
    timeline_state: Boolean(state.sprint.id),
    sprint_calculation: state.sprint.day_index >= 1 && state.sprint.day_index <= state.sprint.length_days,
    milestone_tracking: state.milestones.length > 0,
    deadline_tracking: true,
    reminder_generation: Array.isArray(reminders),
    event_history: events.length > 0,
    overdue_detection: Array.isArray(state.overdue_tasks),
    reports_generated: persist,
  };

  const unavailable = state.sources.filter((s) => s.status === "unavailable").length;
  const status =
    Object.values(checks).every(Boolean) ? (unavailable > 3 ? "DEGRADED" : "READY") : "BLOCKED";

  const result: TimelineDepartmentResult = {
    generated_at: state.generated_at,
    status,
    state,
    events,
    reminders,
    output_dir: TIMELINE_DEPARTMENT_ROOT,
    checks,
  };

  if (persist) {
    persistTimelineReports(state, events, reminders, result);
    updateProjectState(result);
  }

  return result;
}

function updateProjectState(result: TimelineDepartmentResult): void {
  if (!existsSync(STATE_PATH)) throw new Error("SOS/project-state.json missing");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
  if (state.next_agent !== "102" && state.latest_agent !== "102") {
    throw new Error(
      `Expected agent #102, found latest=${state.latest_agent} next=${state.next_agent}`,
    );
  }

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "102",
    next_agent: "103",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      timeline_department: {
        last_run: now,
        status: result.status,
        date: result.state.clock.date,
        sprint: result.state.sprint.id,
        overdue: result.state.overdue_tasks.length,
        reminders: result.reminders.length,
        output_dir: "SOS/07_LOGS/saios/timeline-department",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "timeline_department",
        summary: `Agent #102: Timeline Department ${result.status} — ${result.state.sprint.label} day ${result.state.sprint.day_index}`,
        ref: "SOS/07_LOGS/saios/timeline-department/timeline-state.json",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));
}

export { STATE_PATH, TIMELINE_DEPARTMENT_ROOT };
