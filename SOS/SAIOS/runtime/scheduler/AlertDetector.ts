/**
 * Alert detector — failed production, congestion, resource issues.
 */
import type { SchedulerRunState } from "./types.js";
import { loadJobHistory } from "./SchedulerMemory.js";
import { SCHEDULER_ROOT } from "./SchedulerConfig.js";
import { existsSync } from "node:fs";

export type SchedulerAlert = {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  detected_at: string;
};

export function detectAlerts(state: SchedulerRunState): SchedulerAlert[] {
  const alerts: SchedulerAlert[] = [];
  const now = new Date().toISOString();
  const history = loadJobHistory();

  const recentFailures = history.entries.filter(
    (e) => e.status === "failed" && hoursSince(e.recorded_at) < 6,
  );
  if (recentFailures.length >= 3) {
    alerts.push({
      severity: "critical",
      code: "REPEATED_FAILURES",
      message: `${recentFailures.length} production failures in last 6 hours`,
      detected_at: now,
    });
  }

  const queued = history.entries.filter((e) => e.status === "queued").length;
  const waiting = history.entries.filter((e) => e.awaiting_founder).length;
  if (queued > 10) {
    alerts.push({
      severity: "warning",
      code: "QUEUE_CONGESTION",
      message: `Queue congestion: ${queued} queued jobs`,
      detected_at: now,
    });
  }
  if (waiting > 20) {
    alerts.push({
      severity: "warning",
      code: "PUBLICATION_BACKLOG",
      message: `Founder review backlog: ${waiting} awaiting approval`,
      detected_at: now,
    });
  }

  if (state.status === "interrupted") {
    alerts.push({
      severity: "warning",
      code: "INTERRUPTED_RUN",
      message: `Scheduler interrupted at ${state.interrupted_at}`,
      detected_at: now,
    });
  }

  if (state.jobs_failed_today > 0 && state.jobs_completed_today === 0 && state.jobs_created_today > 2) {
    alerts.push({
      severity: "critical",
      code: "FAILED_PRODUCTION",
      message: "All production attempts failed today",
      detected_at: now,
    });
  }

  const highRetry = history.entries.filter((e) => hoursSince(e.recorded_at) < 24);
  if (highRetry.length > 15) {
    alerts.push({
      severity: "warning",
      code: "RETRY_EXHAUSTION_RISK",
      message: "High job volume may exhaust retry budget",
      detected_at: now,
    });
  }

  if (!existsSync(SCHEDULER_ROOT)) {
    alerts.push({
      severity: "info",
      code: "SCHEDULER_INIT",
      message: "Scheduler output directory initializing",
      detected_at: now,
    });
  }

  return alerts;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
