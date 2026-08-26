/**
 * Founder Operations Dashboard — main director.
 */
import { buildCategoryCoverage } from "./CategoryCoverage.js";
import { buildLiveDashboard, buildStatistics } from "./DashboardBuilder.js";
import { persistDashboardArtifacts, DASHBOARD_ROOT } from "./DashboardReporter.js";
import { listArtifactStages } from "./ArtifactViewer.js";
import { exportDashboardData } from "./ExportService.js";
import { buildHealthMonitor } from "./HealthMonitor.js";
import { buildLearningView } from "./LearningView.js";
import { buildPublicationView } from "./PublicationView.js";
import { buildQueueMonitor } from "./QueueMonitor.js";
import { buildReportsBundle } from "./ReportGenerator.js";
import { buildReviewQueue } from "./ReviewQueue.js";
import { searchFactory } from "./SearchEngine.js";
import { loadSchedulerConfig, loadUnifiedRuns } from "./DataAggregator.js";
import {
  executeFactoryControl,
  getProductionStatus,
  getSchedulerStatus,
  resolveFactoryStatus,
} from "./FactoryController.js";
import type { DashboardBuildResult, FounderDashboardOptions, FounderReviewAction } from "./types.js";
import { join } from "node:path";
import { recordFounderReviewAction } from "./ReviewQueue.js";

export const FOUNDER_OPERATIONS_DASHBOARD = {
  module: "founder-operations-dashboard",
  version: "1.0.0",
  role: "founder_control_center_only",
  description:
    "Single interface to monitor, control, and review the entire Resume Factory. Read-only for production artifacts.",
  prohibitions: [
    "no_resume_generation",
    "no_auto_publish",
    "no_src_modifications",
    "no_artifact_modification",
  ],
} as const;

export async function refreshFounderDashboard(
  options: FounderDashboardOptions = {},
): Promise<DashboardBuildResult> {
  const snapshot = buildLiveDashboard();
  const health = buildHealthMonitor();
  const queue = buildQueueMonitor();
  const review = buildReviewQueue();
  const publication = buildPublicationView();
  const reports = buildReportsBundle();
  const statistics = buildStatistics();
  const learning = buildLearningView();
  const coverage = buildCategoryCoverage();
  const config = loadSchedulerConfig();
  const runs = loadUnifiedRuns();

  const production = {
    updated_at: new Date().toISOString(),
    status: getProductionStatus(),
    active_runs: runs.filter((r) => r.status === "running").map((r) => r.run_id),
    waiting_founder: runs.filter((r) => r.status === "waiting_founder").map((r) => ({
      run_id: r.run_id,
      prototype_id: r.prototype_id,
      objective: r.objective,
    })),
    publication,
    category_coverage: coverage,
    production_goals: {
      daily_target: (config?.workload as { max_resumes_per_day?: number })?.max_resumes_per_day,
      hourly_target: (config?.workload as { max_resumes_per_hour?: number })?.max_resumes_per_hour,
      concurrent_jobs: (config?.workload as { max_concurrent_runs?: number })?.max_concurrent_runs,
      max_retries: (config?.workload as { max_retry_count?: number })?.max_retry_count,
      goals: config?.goals ?? [],
    },
    learning,
    artifacts: listArtifactStages(),
  };

  const factory_status = {
    factory: resolveFactoryStatus(),
    scheduler: getSchedulerStatus(),
    production: getProductionStatus(),
    founder_gate: "ENFORCED",
    auto_publish: false,
    security: "read_only_artifacts",
  };

  const dashboard = {
    ...snapshot,
    review_count: review.total,
    queue_totals: queue.totals,
    search: options.search_query ? searchFactory(options.search_query) : null,
  };

  const artifacts = persistDashboardArtifacts({
    dashboard,
    health,
    queue,
    production,
    review,
    reports,
    statistics,
    factory_status,
    persist: options.persist !== false,
  });

  if (options.persist !== false) {
    exportDashboardData(DASHBOARD_ROOT, {
      snapshot: dashboard,
      queue,
      review,
      reports,
      statistics,
    });
  }

  return {
    pass: true,
    output_dir: DASHBOARD_ROOT,
    artifacts,
    snapshot,
  };
}

export async function loadFounderDashboard(): Promise<DashboardBuildResult> {
  return refreshFounderDashboard({ persist: false });
}

export { executeFactoryControl } from "./FactoryController.js";
export { searchFactory } from "./SearchEngine.js";
export { listArtifactStages, openArtifact } from "./ArtifactViewer.js";
export { exportDashboardData } from "./ExportService.js";

export function submitFounderReview(action: FounderReviewAction): void {
  recordFounderReviewAction(action, join(DASHBOARD_ROOT, "founder-decisions.json"));
}
