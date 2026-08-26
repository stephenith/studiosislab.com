import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { QueueManager } from "../../queue/QueueManager.js";
import type { RegistryManager } from "../../registry/RegistryManager.js";
import type { WorkerFactory } from "../../workers/WorkerFactory.js";
import { assertAllowedDirectorAction } from "./EngineeringPolicies.js";
import { CapacityPlanner } from "./CapacityPlanner.js";
import { WorkloadAnalyzer } from "./WorkloadAnalyzer.js";
import {
  WorkerScalingPolicy,
  type ScalingAction,
  type WorkerScalingPolicyConfig,
} from "./WorkerScalingPolicy.js";
import { resolveEngineeringPaths } from "./paths.js";
import type { WorkloadSnapshot } from "./WorkloadAnalyzer.js";
import type { CapacityEstimate } from "./CapacityPlanner.js";

export type WorkforceScalingReport = {
  report_id: string;
  evaluated_at: string;
  queue_depth: number;
  idle_workers: number;
  busy_workers: number;
  paused_workers: number;
  failed_workers: number;
  average_execution_ms: number;
  required_workers: number;
  deficit: number;
  surplus: number;
  actions: ScalingAction[];
  actions_created: number;
  actions_retired: number;
  actions_paused: number;
  actions_resumed: number;
  total_workers_after: number;
  report_path: string;
};

export type DynamicWorkforceManagerOptions = {
  queue: QueueManager;
  registry: RegistryManager;
  workerFactory: WorkerFactory;
  reportsDir?: string;
  defaultWorkerType?: string;
  policy?: Partial<WorkerScalingPolicyConfig>;
};

export type ScalingCycleResult = {
  snapshot: WorkloadSnapshot;
  capacity: CapacityEstimate;
  report: WorkforceScalingReport;
};

/**
 * Dynamic workforce manager for the Engineering Director.
 * Uses Worker Factory, Registry, and Queue only — never calls Cursor or executes jobs.
 */
export class DynamicWorkforceManager {
  private readonly queue: QueueManager;
  private readonly registry: RegistryManager;
  private readonly workerFactory: WorkerFactory;
  private readonly analyzer: WorkloadAnalyzer;
  private readonly planner: CapacityPlanner;
  private readonly policy: WorkerScalingPolicy;
  private readonly reportsDir?: string;
  private readonly defaultWorkerType: string;

  constructor(options: DynamicWorkforceManagerOptions) {
    this.queue = options.queue;
    this.registry = options.registry;
    this.workerFactory = options.workerFactory;
    this.analyzer = new WorkloadAnalyzer(options.queue, options.registry);
    this.planner = new CapacityPlanner();
    this.policy = new WorkerScalingPolicy(options.policy);
    this.reportsDir = options.reportsDir;
    this.defaultWorkerType = options.defaultWorkerType ?? "resume-worker";
  }

  async analyze(): Promise<WorkloadSnapshot> {
    return this.analyzer.snapshot();
  }

  async planCapacity(snapshot?: WorkloadSnapshot): Promise<CapacityEstimate> {
    const workload = snapshot ?? (await this.analyze());
    return this.planner.estimate(workload);
  }

  async evaluate(): Promise<{ snapshot: WorkloadSnapshot; capacity: CapacityEstimate; actions: ScalingAction[] }> {
    assertAllowedDirectorAction("evaluate_workforce");
    const snapshot = await this.analyze();
    const capacity = await this.planner.estimate(snapshot);
    const actions = this.policy.plan(snapshot, capacity);
    return { snapshot, capacity, actions };
  }

  async applyActions(actions: ScalingAction[]): Promise<ScalingAction[]> {
    const applied: ScalingAction[] = [];

    for (const action of actions) {
      switch (action.type) {
        case "create": {
          const workerType = action.worker_type ?? this.defaultWorkerType;
          const worker = await this.workerFactory.createWorker({
            worker_type: workerType,
            metadata: {
              temporary: true,
              workforce_tier: "temporary",
              scaled_for_backlog: true,
              created_by: "dynamic-workforce-manager",
            },
          });
          applied.push({ ...action, worker_id: worker.worker_id });
          break;
        }
        case "retire": {
          if (!action.worker_id) continue;
          const worker = await this.workerFactory.getWorker(action.worker_id);
          if (!worker || worker.status === "RETIRED" || worker.current_job) continue;
          await this.workerFactory.retireWorker(action.worker_id, action.reason);
          applied.push(action);
          break;
        }
        case "pause": {
          if (!action.worker_id) continue;
          const worker = await this.workerFactory.getWorker(action.worker_id);
          if (!worker || worker.status !== "READY") continue;
          await this.workerFactory.pauseWorker(action.worker_id, action.reason);
          applied.push(action);
          break;
        }
        case "resume": {
          if (!action.worker_id) continue;
          const worker = await this.workerFactory.getWorker(action.worker_id);
          if (!worker || worker.status !== "PAUSED") continue;
          await this.workerFactory.resumeWorker(action.worker_id, action.reason);
          applied.push(action);
          break;
        }
      }
    }

    return applied;
  }

  async runScalingCycle(): Promise<ScalingCycleResult> {
    assertAllowedDirectorAction("scale_workforce");
    const { snapshot, capacity, actions } = await this.evaluate();
    const applied = await this.applyActions(actions);
    const after = await this.analyze();

    const report = await this.writeScalingReport({
      snapshot,
      capacity,
      actions: applied,
      totalWorkersAfter: after.total_workers,
    });

    return { snapshot, capacity, report };
  }

  private async writeScalingReport(input: {
    snapshot: WorkloadSnapshot;
    capacity: CapacityEstimate;
    actions: ScalingAction[];
    totalWorkersAfter: number;
  }): Promise<WorkforceScalingReport> {
    const reportId = `WF-SCALE-${Date.now()}`;
    const actionsCreated = input.actions.filter((a) => a.type === "create").length;
    const actionsRetired = input.actions.filter((a) => a.type === "retire").length;
    const actionsPaused = input.actions.filter((a) => a.type === "pause").length;
    const actionsResumed = input.actions.filter((a) => a.type === "resume").length;

    const relPath = `SOS/07_LOGS/saios/directors/engineering/workforce/${reportId}.json`;
    const report: WorkforceScalingReport = {
      report_id: reportId,
      evaluated_at: input.snapshot.evaluated_at,
      queue_depth: input.snapshot.queue_depth,
      idle_workers: input.snapshot.idle_workers,
      busy_workers: input.snapshot.busy_workers,
      paused_workers: input.snapshot.paused_workers,
      failed_workers: input.snapshot.failed_workers,
      average_execution_ms: input.snapshot.average_execution_ms,
      required_workers: input.capacity.required_workers,
      deficit: input.capacity.deficit,
      surplus: input.capacity.surplus,
      actions: input.actions,
      actions_created: actionsCreated,
      actions_retired: actionsRetired,
      actions_paused: actionsPaused,
      actions_resumed: actionsResumed,
      total_workers_after: input.totalWorkersAfter,
      report_path: relPath,
    };

    const dir =
      this.reportsDir ??
      join(resolveEngineeringPaths().repoRoot, "SOS", "07_LOGS", "saios", "directors", "engineering", "workforce");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${reportId}.json`), JSON.stringify(report, null, 2), "utf8");
    return report;
  }
}
