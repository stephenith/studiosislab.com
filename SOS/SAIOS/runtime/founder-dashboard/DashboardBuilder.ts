/**
 * Dashboard builder — assembles live dashboard snapshot.
 */
import { loadSchedulerDashboard, loadUnifiedRuns } from "./DataAggregator.js";
import {
  getProductionStatus,
  getSchedulerStatus,
  resolveFactoryStatus,
} from "./FactoryController.js";
import { buildHealthMonitor } from "./HealthMonitor.js";
import type { FounderDashboardSnapshot } from "./types.js";

export function buildLiveDashboard(): FounderDashboardSnapshot {
  const schedulerDash = loadSchedulerDashboard();
  const runs = loadUnifiedRuns();
  const activeRun = runs.find((r) => r.status === "running") ?? runs.find((r) => r.status === "waiting_founder");
  const health = buildHealthMonitor();

  const waitingCount = runs.filter((r) => r.status === "waiting_founder").length;
  const completedToday = Number(schedulerDash?.jobs_completed_today ?? 0);
  const rate = completedToday > 0 ? completedToday : waitingCount;

  return {
    generated_at: new Date().toISOString(),
    factory_status: resolveFactoryStatus(),
    scheduler_status: getSchedulerStatus(),
    production_status: getProductionStatus(),
    current_stage: activeRun ? String(activeRun.current_stage ?? "waiting_founder") : null,
    current_objective: activeRun ? String(activeRun.objective ?? null) : null,
    current_worker: activeRun ? "unified-resume-production-engine" : null,
    queue_size: Number(schedulerDash?.waiting_founder ?? 0) + Number(schedulerDash?.jobs_created_today ?? 0),
    production_rate_per_hour: rate,
    estimated_completion_pct: Math.min(100, Math.round((waitingCount / Math.max(1, waitingCount + 5)) * 100)),
    health:
      health.recovery_status === "critical"
        ? "critical"
        : health.recovery_status === "degraded"
          ? "degraded"
          : "healthy",
  };
}

export function buildStatistics() {
  const runs = loadUnifiedRuns();
  const health = buildHealthMonitor();
  const schedulerDash = loadSchedulerDashboard();

  return {
    updated_at: new Date().toISOString(),
    total_production_runs: runs.length,
    waiting_founder: runs.filter((r) => r.status === "waiting_founder").length,
    failed_runs: runs.filter((r) => r.status === "failed").length,
    jobs_created_today: schedulerDash?.jobs_created_today ?? 0,
    jobs_completed_today: schedulerDash?.jobs_completed_today ?? 0,
    average_runtime_ms: health.average_runtime_ms,
    average_quality: health.average_quality,
    average_confidence: health.average_confidence,
    failure_rate_pct: health.failure_rate_pct,
  };
}
