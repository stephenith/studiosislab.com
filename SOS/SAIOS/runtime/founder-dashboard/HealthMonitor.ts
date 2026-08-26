/**
 * Health monitor — system and factory health metrics.
 */
import { statfsSync } from "node:fs";
import { loadSchedulerHealth, loadJobHistory, loadUnifiedRuns } from "./DataAggregator.js";
import { getProductionStatus, getSchedulerStatus } from "./FactoryController.js";

export function buildHealthMonitor() {
  const schedulerHealth = loadSchedulerHealth();
  const history = loadJobHistory()?.entries ?? [];
  const runs = loadUnifiedRuns();
  const completed = history.filter((e) => e.status === "waiting_founder" || e.status === "completed");
  const failed = history.filter((e) => e.status === "failed");

  const avgRuntime =
    completed.length > 0
      ? Math.round(
          completed.reduce((a, e) => a + Number((e as { duration_ms?: number }).duration_ms ?? 60000), 0) /
            completed.length,
        )
      : 0;

  const qualities = runs
    .map((r) => (r.quality as { overall_confidence?: number })?.overall_confidence)
    .filter((q): q is number => typeof q === "number");
  const avgQuality =
    qualities.length > 0 ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0;

  let disk_mb = 10000;
  let memory_note = "Node.js process";
  try {
    const stats = statfsSync("/");
    disk_mb = Math.round((stats.bfree * stats.bsize) / (1024 * 1024));
  } catch {
    /* ignore */
  }

  return {
    updated_at: new Date().toISOString(),
    cpu: { status: "nominal", note: "Host-level CPU requires OS agent" },
    memory: { status: "nominal", note: memory_note },
    disk_usage_mb: disk_mb,
    queue_size: history.filter((e) => e.status === "queued").length,
    scheduler_status: getSchedulerStatus(),
    production_status: getProductionStatus(),
    recovery_status: schedulerHealth?.overall_health ?? "unknown",
    average_runtime_ms: avgRuntime,
    average_quality: avgQuality,
    average_confidence: avgQuality,
    failure_rate_pct:
      history.length > 0 ? Math.round((failed.length / history.length) * 100) : 0,
    alerts: schedulerHealth?.alerts ?? [],
  };
}
