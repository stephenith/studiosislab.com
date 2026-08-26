/**
 * Report builder — dashboard, health, history, statistics, daily summary.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectAlerts } from "./AlertDetector.js";
import { analyzeCategoryCoverage } from "./SmartProduction.js";
import { loadJobHistory, loadSchedulerMemory } from "./SchedulerMemory.js";
import { SCHEDULER_ROOT } from "./SchedulerConfig.js";
import type { SchedulerConfig, SchedulerRunState } from "./types.js";

export function persistSchedulerReports(input: {
  state: SchedulerRunState;
  config: SchedulerConfig;
  persist?: boolean;
}): {
  dashboard_path: string;
  health_path: string;
  history_path: string;
  statistics_path: string;
  daily_summary_path: string;
} {
  const persist = input.persist !== false;
  if (persist) mkdirSync(SCHEDULER_ROOT, { recursive: true });

  const alerts = detectAlerts(input.state);
  const coverage = analyzeCategoryCoverage();
  const memory = loadSchedulerMemory();
  const jobHistory = loadJobHistory();

  const dashboard = {
    updated_at: new Date().toISOString(),
    scheduler_id: input.state.scheduler_id,
    status: input.state.status,
    current_stage: "scheduling",
    jobs_created_today: input.state.jobs_created_today,
    jobs_completed_today: input.state.jobs_completed_today,
    jobs_failed_today: input.state.jobs_failed_today,
    active_runs: input.state.active_run_ids.length,
    waiting_founder: jobHistory.entries.filter((e) => e.awaiting_founder).length,
    goals_enabled: input.config.goals.filter((g) => g.enabled).length,
    founder_gate: "ENFORCED",
    auto_publish: false,
    alerts: alerts.length,
  };

  const health = {
    updated_at: new Date().toISOString(),
    overall_health: alerts.some((a) => a.severity === "critical")
      ? "critical"
      : alerts.some((a) => a.severity === "warning")
        ? "degraded"
        : "healthy",
    alerts,
    workload: input.config.workload,
    server_mode: input.config.server_mode,
  };

  const history = {
    updated_at: new Date().toISOString(),
    scheduler_id: input.state.scheduler_id,
    started_at: input.state.started_at,
    last_tick_at: input.state.last_tick_at,
    interrupted_at: input.state.interrupted_at,
    events: memory.entries.slice(-50),
  };

  const avgDuration =
    memory.entries.length > 0
      ? Math.round(memory.entries.reduce((a, e) => a + e.duration_ms, 0) / memory.entries.length)
      : 0;
  const failureRate =
    jobHistory.entries.length > 0
      ? Math.round(
          (jobHistory.entries.filter((e) => e.status === "failed").length / jobHistory.entries.length) * 100,
        )
      : 0;

  const statistics = {
    updated_at: new Date().toISOString(),
    total_jobs: jobHistory.entries.length,
    awaiting_founder: jobHistory.entries.filter((e) => e.awaiting_founder).length,
    average_duration_ms: avgDuration,
    failure_rate_pct: failureRate,
    category_coverage: coverage,
    generation_trends: memory.entries.slice(-20).map((e) => ({
      at: e.recorded_at,
      category: e.category,
      duration_ms: e.duration_ms,
    })),
  };

  const daily = {
    date: new Date().toISOString().slice(0, 10),
    jobs_created: input.state.jobs_created_today,
    jobs_completed: input.state.jobs_completed_today,
    jobs_failed: input.state.jobs_failed_today,
    top_categories: coverage
      .sort((a, b) => b.priority_boost - a.priority_boost)
      .slice(0, 5)
      .map((c) => ({ category: c.category, boost: c.priority_boost })),
    founder_gate_preserved: true,
    auto_publish: false,
  };

  const paths = {
    dashboard_path: join(SCHEDULER_ROOT, "scheduler-dashboard.json"),
    health_path: join(SCHEDULER_ROOT, "scheduler-health.json"),
    history_path: join(SCHEDULER_ROOT, "scheduler-history.json"),
    statistics_path: join(SCHEDULER_ROOT, "production-statistics.json"),
    daily_summary_path: join(SCHEDULER_ROOT, "daily-summary.json"),
  };

  if (persist) {
    writeFileSync(paths.dashboard_path, JSON.stringify(dashboard, null, 2));
    writeFileSync(paths.health_path, JSON.stringify(health, null, 2));
    writeFileSync(paths.history_path, JSON.stringify(history, null, 2));
    writeFileSync(paths.statistics_path, JSON.stringify(statistics, null, 2));
    writeFileSync(paths.daily_summary_path, JSON.stringify(daily, null, 2));
  }

  return paths;
}
