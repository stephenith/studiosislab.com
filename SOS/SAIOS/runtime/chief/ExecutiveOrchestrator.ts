import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { JobId, PlanId } from "../shared/types.js";
import { comparePriority, QueueManager } from "../queue/QueueManager.js";
import { RegistryManager } from "../registry/RegistryManager.js";
import type { SaiosJob } from "../queue/types.js";
import { DecisionEngine } from "./DecisionEngine.js";
import { Planner } from "./Planner.js";
import { Dispatcher } from "./Dispatcher.js";
import { ProgressTracker } from "./ProgressTracker.js";
import { resolveChiefPaths } from "./paths.js";
import type {
  ChiefCommandResult,
  CompletionReport,
  ExecutionPlan,
  FounderCommand,
  JobReportSummary,
  ProgressSnapshot,
  WorkerAssignment,
} from "./types.js";

export type ExecutiveOrchestratorOptions = {
  queue: QueueManager;
  registry: RegistryManager;
  reportsDir?: string;
};

/**
 * Executive Orchestrator — the ONLY SAIOS component allowed to make decisions.
 * Plans, delegates, and tracks work. Never edits code or runs Cursor.
 */
export class ExecutiveOrchestrator {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly decisionEngine: DecisionEngine;
  private readonly planner: Planner;
  private readonly dispatcher: Dispatcher;
  private readonly progressTracker: ProgressTracker;
  private readonly reportsDir: string;

  private activePlan: ExecutionPlan | null = null;
  private activeJobIds: JobId[] = [];

  constructor(options: ExecutiveOrchestratorOptions) {
    this.queue = options.queue;
    this.registry = options.registry;
    this.decisionEngine = new DecisionEngine();
    this.planner = new Planner(this.decisionEngine);
    this.dispatcher = new Dispatcher(this.registry);
    this.progressTracker = new ProgressTracker(this.queue);
    this.reportsDir = options.reportsDir ?? resolveChiefPaths().reportsDir;
  }

  getActivePlan(): ExecutionPlan | null {
    return this.activePlan;
  }

  async receiveFounderCommand(command: FounderCommand): Promise<ChiefCommandResult> {
    const text = command.raw_text.trim();
    if (!text) {
      return { accepted: false, reply: "Empty founder command rejected." };
    }

    const plan = await this.createExecutionPlan(command);
    const jobs = await this.createJobs(plan);
    const assignments = await this.selectWorkers(plan, jobs);
    await this.assignJobs(assignments);

    this.activePlan = plan;
    this.activeJobIds = jobs.map((j) => j.id);

    return {
      accepted: true,
      reply: `Accepted. Plan ${plan.id} created with ${jobs.length} job(s); ${assignments.length} worker(s) assigned.`,
      plan_id: plan.id,
      job_ids: jobs.map((j) => j.id),
    };
  }

  async createExecutionPlan(command: FounderCommand): Promise<ExecutionPlan> {
    const decision = this.decisionEngine.analyze(command);
    return this.planner.buildPlan(command, decision);
  }

  async createJobs(plan: ExecutionPlan): Promise<SaiosJob[]> {
    const idByKey = new Map<string, JobId>();
    const created: SaiosJob[] = [];

    const sorted = [...plan.jobs].sort((a, b) => a.step - b.step);

    for (const planned of sorted) {
      const dependencies = (planned.depends_on ?? [])
        .map((key) => idByKey.get(key))
        .filter((id): id is JobId => Boolean(id));

      const job = await this.queue.createJob({
        id: `JOB-${plan.id.replace(/^PLAN-/, "")}-${planned.temp_key}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
        title: planned.title,
        description: planned.description,
        priority: planned.priority,
        creator: "executive-orchestrator",
        dependencies,
        metadata: {
          ...planned.metadata,
          plan_id: plan.id,
          temp_key: planned.temp_key,
          required_capability: planned.required_capability,
          step: planned.step,
        },
      });

      idByKey.set(planned.temp_key, job.id);
      created.push(job);
    }

    return created;
  }

  async selectWorkers(plan: ExecutionPlan, jobs: SaiosJob[]): Promise<WorkerAssignment[]> {
    return this.dispatcher.selectWorkers(plan, jobs);
  }

  async assignJobs(assignments: WorkerAssignment[]): Promise<void> {
    for (const assignment of assignments) {
      await this.queue.assignWorker(assignment.job_id, assignment.worker_id);
      await this.registry.assignJob(assignment.worker_id, assignment.job_id);
    }
  }

  /**
   * Decide which queued jobs are ready to run (dependencies satisfied, deterministic order).
   */
  async decideRunnableJobs(): Promise<SaiosJob[]> {
    const all = await this.queue.listJobs();
    const jobsById = new Map(all.map((j) => [j.id, j]));
    return all
      .filter((j) => j.status === "QUEUED" && !j.assigned_worker)
      .filter((j) => {
        for (const depId of j.dependencies) {
          const dep = jobsById.get(depId);
          if (!dep || dep.status !== "COMPLETED") return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pri = comparePriority(a.priority, b.priority);
        if (pri !== 0) return pri;
        const stepA = typeof a.metadata?.step === "number" ? a.metadata.step : 0;
        const stepB = typeof b.metadata?.step === "number" ? b.metadata.step : 0;
        if (stepA !== stepB) return stepA - stepB;
        return a.created_at.localeCompare(b.created_at);
      });
  }

  /**
   * Select worker assignments for the next runnable batch.
   */
  async scheduleNextBatch(): Promise<WorkerAssignment[]> {
    const all = await this.queue.listJobs();
    return this.dispatcher.selectWorkersForJobs(all);
  }

  async trackExecution(planId?: PlanId): Promise<ProgressSnapshot> {
    const id = planId ?? this.activePlan?.id;
    return this.progressTracker.snapshot(id);
  }

  async collectReports(jobIds: JobId[]): Promise<JobReportSummary[]> {
    const reports: JobReportSummary[] = [];
    for (const jobId of jobIds) {
      const job = await this.queue.loadJob(jobId);
      if (!job) continue;
      reports.push({
        job_id: job.id,
        title: job.title,
        status: job.status,
        assigned_worker: job.assigned_worker,
        report_path: job.report_path,
      });
    }
    return reports;
  }

  /**
   * Record delegated job progress (orchestration tracking only — no Cursor execution).
   */
  async recordJobRunning(jobId: JobId): Promise<SaiosJob> {
    let job = await this.queue.loadJob(jobId);
    if (!job) {
      throw new Error(`ExecutiveOrchestrator: job not found: ${jobId}`);
    }

    while (job.status === "QUEUED" || job.status === "PLANNING") {
      if (job.status === "QUEUED") {
        const cap = job.metadata?.required_capability;
        if (cap === "plan") {
          job = await this.queue.updateStatus(jobId, { status: "PLANNING", note: "planning" }, "executive-orchestrator");
        } else {
          job = await this.queue.updateStatus(jobId, { status: "RUNNING", note: "running" }, "executive-orchestrator");
        }
      } else {
        job = await this.queue.updateStatus(jobId, { status: "RUNNING", note: "running" }, "executive-orchestrator");
      }
    }

    return job;
  }

  async recordDelegatedCompletion(jobId: JobId, reportPath?: string): Promise<SaiosJob> {
    let job = await this.queue.loadJob(jobId);
    if (!job) {
      throw new Error(`ExecutiveOrchestrator: job not found: ${jobId}`);
    }

    job = await this.recordJobRunning(jobId);

    if (job.status === "RUNNING") {
      job = await this.queue.updateStatus(
        jobId,
        { status: "WAITING_QA", note: "delegated work complete" },
        "executive-orchestrator",
      );
    }

    if (job.status === "WAITING_QA") {
      job = await this.queue.completeJob(jobId, reportPath ?? job.report_path ?? undefined);
    }

    if (job.assigned_worker) {
      await this.registry.releaseJob(job.assigned_worker, `completed ${jobId}`);
    }

    return this.queue.loadJob(jobId) as Promise<SaiosJob>;
  }

  async finishExecution(planId: PlanId): Promise<CompletionReport> {
    const plan = this.activePlan?.id === planId ? this.activePlan : null;
    const progress = await this.trackExecution(planId);

    const planJobs = await this.queue.listJobs();
    const jobIds = planJobs.filter((j) => j.metadata?.plan_id === planId).map((j) => j.id);
    const job_reports = await this.collectReports(jobIds.length > 0 ? jobIds : this.activeJobIds);

    const success =
      progress.failed === 0 &&
      progress.completed === progress.total_jobs &&
      progress.total_jobs > 0;

    const report: CompletionReport = {
      plan_id: planId,
      goal: plan?.goal ?? "Unknown goal",
      summary: plan?.summary ?? "Execution finished",
      finished_at: new Date().toISOString(),
      progress,
      job_reports,
      success,
    };

    await mkdir(this.reportsDir, { recursive: true });
    const reportPath = join(this.reportsDir, `${planId}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    return report;
  }
}
