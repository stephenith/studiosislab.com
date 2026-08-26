#!/usr/bin/env tsx
/**
 * Timeline Department verification.
 * AGENT #102
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runTimelineDepartment,
  STATE_PATH,
  TIMELINE_DEPARTMENT,
  TIMELINE_DEPARTMENT_ROOT,
} from "./TimelineDepartmentDirector.js";
import { readTimelineClock } from "./TimelineClock.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(TIMELINE_DEPARTMENT.module === "timeline-department", "module id");
  assert(TIMELINE_DEPARTMENT.agent === "102", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    factory_v1?: { status?: string };
    operations?: {
      website_department?: { status?: string };
      notification_department?: { status?: string };
    };
    latest_catalog: string;
    latest_release: string;
  };
  assert(
    preState.next_agent === "102" || preState.latest_agent === "102",
    "pre-flight: expected agent #102",
  );
  assert(preState.latest_agent === "101" || preState.latest_agent === "102", "latest was #101");
  assert(preState.factory_v1?.status === "STABLE", "factory STABLE");
  assert(
    preState.operations?.notification_department?.status === "READY",
    "notification READY",
  );
  assert(
    Boolean(preState.operations?.website_department?.status),
    "website department present",
  );

  const clock = readTimelineClock();
  assert(Boolean(clock.date && clock.time), "clock");

  const result = runTimelineDepartment({ persist: true });

  const required = [
    "timeline-state.json",
    "timeline-events.json",
    "timeline-reminders.json",
    "timeline-summary.md",
    "timeline-history.md",
    "timeline-dashboard.json",
    "timeline-report.md",
  ];
  for (const file of required) {
    assert(existsSync(join(TIMELINE_DEPARTMENT_ROOT, file)), `report: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { timeline_department: Record<string, unknown> };
  };
  assert(saved.latest_agent === "102", "latest_agent");
  assert(saved.next_agent === "103", "next_agent");
  assert(saved.operations.timeline_department?.last_run, "operations.timeline_department");

  assert(result.checks.clock, "clock check");
  assert(result.checks.timeline_state, "timeline state");
  assert(result.checks.sprint_calculation, "sprint calculation");
  assert(result.checks.milestone_tracking, "milestone tracking");
  assert(result.checks.deadline_tracking, "deadline tracking");
  assert(result.checks.reminder_generation, "reminder generation");
  assert(result.checks.event_history, "event history");
  assert(result.checks.overdue_detection, "overdue detection");
  assert(result.checks.reports_generated, "reports generated");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "timeline-department",
        agent: "102",
        status: result.status,
        date: result.state.clock.date,
        sprint: result.state.sprint,
        pending_work: result.state.pending_work.length,
        overdue: result.state.overdue_tasks.length,
        reminders: result.reminders.length,
        events: result.events.length,
        milestones_upcoming: result.state.milestones.filter((m) => m.status === "upcoming").map((m) => m.title),
        checks: result.checks,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main();
