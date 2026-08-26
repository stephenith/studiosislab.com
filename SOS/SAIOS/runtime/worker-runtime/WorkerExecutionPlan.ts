/**
 * WorkerExecutionPlan — placeholder plan metadata (Agent #182).
 * Never schedules.
 */
import { randomUUID } from "node:crypto";
import type { WorkerExecutionPlanPlaceholder } from "./WorkerRuntimeTypes.js";

export function createWorkerExecutionPlan(input: {
  worker_runtime_ids?: string[];
  topological_order?: string[];
  note?: string;
}): WorkerExecutionPlanPlaceholder {
  return {
    plan_id: `wep-${randomUUID().slice(0, 8)}`,
    worker_runtime_ids: input.worker_runtime_ids ?? [],
    topological_order: input.topological_order ?? [],
    scheduled: false,
    note:
      input.note ??
      "Execution plan placeholder · not scheduled · Agent #182",
  };
}

export class WorkerExecutionPlan {
  readonly plan: WorkerExecutionPlanPlaceholder;

  constructor(plan: WorkerExecutionPlanPlaceholder) {
    this.plan = plan;
  }

  isScheduled(): false {
    return false;
  }
}
