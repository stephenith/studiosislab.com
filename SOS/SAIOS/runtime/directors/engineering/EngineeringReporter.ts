import { mkdir, writeFile } from "node:fs/promises";
import type { QueueManager } from "../../queue/QueueManager.js";
import type { RegistryManager } from "../../registry/RegistryManager.js";
import { assertAllowedDirectorAction } from "./EngineeringPolicies.js";
import { engineeringReportPath, resolveEngineeringPaths } from "./paths.js";
import type {
  EngineeringCompletionReport,
  EngineeringMetrics,
  EngineeringPlan,
  EngineeringProgress,
  EngineeringSummary,
} from "./types.js";

export class EngineeringReporter {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly reportsDir: string;

  constructor(
    queue: QueueManager,
    registry: RegistryManager,
    reportsDir?: string,
  ) {
    this.queue = queue;
    this.registry = registry;
    this.reportsDir = reportsDir ?? resolveEngineeringPaths().reportsDir;
  }

  async collectProgress(plan: EngineeringPlan): Promise<EngineeringProgress> {
    const all = await this.queue.listJobs();
    const jobs = all.filter((j) => j.metadata?.engineering_plan_id === plan.id);

    let queued = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      switch (job.status) {
        case "QUEUED":
        case "PLANNING":
          queued++;
          break;
        case "RUNNING":
        case "WAITING_QA":
          running++;
          break;
        case "COMPLETED":
          completed++;
          break;
        case "FAILED":
        case "CANCELLED":
          failed++;
          break;
        default:
          break;
      }
    }

    const total = jobs.length;
    return {
      plan_id: plan.id,
      total_jobs: total,
      queued,
      running,
      completed,
      failed,
      overall_percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      updated_at: new Date().toISOString(),
    };
  }

  buildMetrics(plan: EngineeringPlan, progress: EngineeringProgress, workerTypesUsed: string[]): EngineeringMetrics {
    return {
      plan_id: plan.id,
      total_jobs: progress.total_jobs,
      completed_jobs: progress.completed,
      failed_jobs: progress.failed,
      workers_used: workerTypesUsed.length,
      worker_types_used: workerTypesUsed,
      duration_estimate: plan.estimated_duration,
    };
  }

  buildSummary(plan: EngineeringPlan, progress: EngineeringProgress): EngineeringSummary {
    const success = progress.failed === 0 && progress.completed === progress.total_jobs;
    return {
      plan_id: plan.id,
      goal: plan.goal,
      success,
      headline: success
        ? `Engineering objective complete: ${plan.goal}`
        : `Engineering objective in progress: ${progress.completed}/${progress.total_jobs} tasks`,
      tasks_completed: progress.completed,
      tasks_total: progress.total_jobs,
    };
  }

  async collectJobReports(plan: EngineeringPlan) {
    const all = await this.queue.listJobs();
    return all
      .filter((j) => j.metadata?.engineering_plan_id === plan.id)
      .map((j) => ({
        job_id: j.id,
        title: j.title,
        worker_type: String(j.metadata?.worker_type ?? "unknown"),
        status: j.status,
        assigned_worker: j.assigned_worker,
      }));
  }

  async generateCompletionReport(
    plan: EngineeringPlan,
    workerTypesUsed: string[],
  ): Promise<EngineeringCompletionReport> {
    assertAllowedDirectorAction("generate_report");

    const progress = await this.collectProgress(plan);
    const metrics = this.buildMetrics(plan, progress, workerTypesUsed);
    const summary = this.buildSummary(plan, progress);
    const job_reports = await this.collectJobReports(plan);

    const relPath = `SOS/07_LOGS/saios/directors/engineering/reports/${plan.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;

    const report: EngineeringCompletionReport = {
      plan_id: plan.id,
      goal: plan.goal,
      priority: plan.priority,
      finished_at: new Date().toISOString(),
      summary,
      metrics,
      progress,
      job_reports,
      report_path: relPath,
    };

    await mkdir(this.reportsDir, { recursive: true });
    await writeFile(engineeringReportPath(this.reportsDir, plan.id), JSON.stringify(report, null, 2), "utf8");

    return report;
  }
}
