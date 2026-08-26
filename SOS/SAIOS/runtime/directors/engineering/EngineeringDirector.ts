import type { JobId } from "../../shared/types.js";
import type { QueueManager } from "../../queue/QueueManager.js";
import type { RegistryManager } from "../../registry/RegistryManager.js";
import { assertAllowedDirectorAction, directorScopeNote } from "./EngineeringPolicies.js";
import { EngineeringPlanner } from "./EngineeringPlanner.js";
import { EngineeringDelegator } from "./EngineeringDelegator.js";
import { EngineeringReporter } from "./EngineeringReporter.js";
import type { EngineeringExecutionCoordinator } from "./EngineeringExecutionCoordinator.js";
import type { EngineeringExecutionReport } from "./EngineeringExecutionReport.js";
import type { DynamicWorkforceManager } from "./DynamicWorkforceManager.js";
import type { ScalingCycleResult } from "./DynamicWorkforceManager.js";
import type { FactoryWorker } from "../../workers/WorkerDefinition.js";
import type { SaiosJob } from "../../queue/types.js";
import type {
  EngineeringDirectorResult,
  EngineeringObjective,
  EngineeringPlan,
  EngineeringProgress,
  DelegationResult,
} from "./types.js";

export type EngineeringDirectorOptions = {
  queue: QueueManager;
  registry: RegistryManager;
  reportsDir?: string;
  executionCoordinator?: EngineeringExecutionCoordinator;
  workforceManager?: DynamicWorkforceManager;
};

/**
 * Engineering Director — permanent orchestration layer for software engineering.
 * Never edits code, calls Cursor, or executes work directly.
 */
export class EngineeringDirector {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly planner: EngineeringPlanner;
  private readonly delegator: EngineeringDelegator;
  private readonly reporter: EngineeringReporter;
  private readonly executionCoordinator: EngineeringExecutionCoordinator | null;
  private readonly workforceManager: DynamicWorkforceManager | null;

  constructor(options: EngineeringDirectorOptions) {
    this.queue = options.queue;
    this.registry = options.registry;
    this.planner = new EngineeringPlanner();
    this.delegator = new EngineeringDelegator(this.queue, this.registry);
    this.reporter = new EngineeringReporter(this.queue, this.registry, options.reportsDir);
    this.executionCoordinator = options.executionCoordinator ?? null;
    this.workforceManager = options.workforceManager ?? null;
  }

  getScopeNote(): string {
    return directorScopeNote();
  }

  analyseObjective(objective: EngineeringObjective): EngineeringPlan {
    assertAllowedDirectorAction("analyse_objective");
    return this.planner.buildPlan(objective);
  }

  async delegatePlan(plan: EngineeringPlan): Promise<DelegationResult> {
    return this.delegator.delegate(plan);
  }

  async monitorProgress(plan: EngineeringPlan): Promise<EngineeringProgress> {
    return this.reporter.collectProgress(plan);
  }

  async assignReadyJobs(plan: EngineeringPlan, jobIds: JobId[]): Promise<void> {
    await this.delegator.assignJobs(plan, jobIds);
  }

  /**
   * Delegate one assigned engineering job to Cursor Runner via execution coordinator.
   * Director never calls Cursor directly.
   */
  async executeDelegatedJob(
    worker: FactoryWorker | { worker_id: string; worker_type: string; display_name: string; capabilities: string[]; priority: FactoryWorker["priority"]; parent_director: string | null },
    job: SaiosJob,
    options?: { prompt_override?: string },
  ): Promise<EngineeringExecutionReport> {
    assertAllowedDirectorAction("delegate_cursor_execution");
    if (!this.executionCoordinator) {
      throw new Error("EngineeringDirector: executionCoordinator not configured");
    }
    return this.executionCoordinator.executeAssignedJob(worker, job, options);
  }

  /**
   * Scale engineering workforce up or down based on queue and worker metrics.
   * Never calls Cursor or executes jobs.
   */
  async scaleWorkforce(): Promise<ScalingCycleResult> {
    assertAllowedDirectorAction("scale_workforce");
    if (!this.workforceManager) {
      throw new Error("EngineeringDirector: workforceManager not configured");
    }
    return this.workforceManager.runScalingCycle();
  }

  /**
   * Orchestrate one engineering objective end-to-end (no Cursor execution).
   */
  async execute(objective: EngineeringObjective): Promise<EngineeringDirectorResult> {
    assertAllowedDirectorAction("execute_engineering_objective");

    const plan = this.analyseObjective(objective);
    const delegation = await this.delegatePlan(plan);

    const workerTypesUsed = delegation.worker_requests.map((w) => w.worker_type);

    const report = await this.reporter.generateCompletionReport(plan, workerTypesUsed);
    const progress = await this.monitorProgress(plan);

    return {
      plan,
      delegation,
      progress,
      report,
    };
  }

  /**
   * Full orchestration including assignment waves (for verify / runtime handoff).
   * Does not run Cursor — marks jobs complete via orchestration callbacks only when provided.
   */
  async executeWithMonitoring(
    objective: EngineeringObjective,
    options?: {
      onJobReady?: (jobId: JobId) => Promise<void>;
      maxWaves?: number;
    },
  ): Promise<EngineeringDirectorResult> {
    const plan = this.analyseObjective(objective);
    let delegation = await this.delegatePlan(plan);
    const maxWaves = options?.maxWaves ?? 20;

    for (let wave = 0; wave < maxWaves; wave++) {
      const progress = await this.monitorProgress(plan);
      if (progress.completed === progress.total_jobs && progress.total_jobs > 0) break;

      const jobs = await this.queue.listJobs();
      const active = jobs.filter(
        (j) =>
          j.metadata?.engineering_plan_id === plan.id &&
          j.assigned_worker &&
          j.status !== "COMPLETED" &&
          j.status !== "FAILED",
      );

      for (const job of active) {
        if (options?.onJobReady) {
          await options.onJobReady(job.id);
        }
      }

      const more = await this.delegator.assignJobs(plan, delegation.job_ids);
      if (more.length > 0) {
        delegation = { ...delegation, assignments: [...delegation.assignments, ...more] };
      }

      const after = await this.monitorProgress(plan);
      if (after.completed === after.total_jobs && after.total_jobs > 0) break;
    }

    const workerTypesUsed = [...new Set(delegation.worker_requests.map((w) => w.worker_type))];
    const report = await this.reporter.generateCompletionReport(plan, workerTypesUsed);
    const progress = await this.monitorProgress(plan);

    return { plan, delegation, progress, report };
  }
}
