/**
 * Batch planning — split founder requests into resume jobs.
 */
import { randomUUID } from "node:crypto";
import type { BatchPlan, ProductionPriority, ResumeJob } from "./types.js";
import { DIRECTOR_POLICIES } from "./ProductionPolicies.js";
import { PRODUCTION_PRIORITIES } from "./types.js";

export type PlanRequest = {
  size: number;
  primary_priority: ProductionPriority;
  batch_id?: string;
};

export function createBatchPlan(request: PlanRequest): BatchPlan {
  const size = normalizeBatchSize(request.size);
  const batch_id = request.batch_id ?? `batch-${randomUUID().slice(0, 8)}`;
  const distribution = distributePriorities(size, request.primary_priority);
  const jobs = buildJobs(batch_id, size, distribution);

  return {
    batch_id,
    created_at: new Date().toISOString(),
    requested_by: "founder",
    size,
    primary_priority: request.primary_priority,
    priorities_distribution: distribution,
    jobs,
    policies_version: DIRECTOR_POLICIES.version,
  };
}

function normalizeBatchSize(size: number): number {
  const allowed = DIRECTOR_POLICIES.default_batch_sizes;
  if (allowed.includes(size as (typeof allowed)[number])) return size;
  const sorted = [...allowed].sort((a, b) => Math.abs(a - size) - Math.abs(b - size));
  return sorted[0]!;
}

function distributePriorities(
  size: number,
  primary: ProductionPriority,
): Record<ProductionPriority, number> {
  const dist = Object.fromEntries(PRODUCTION_PRIORITIES.map((p) => [p, 0])) as Record<
    ProductionPriority,
    number
  >;

  dist[primary] = Math.ceil(size * 0.4);
  const remaining = size - dist[primary];
  const secondary = PRODUCTION_PRIORITIES.filter((p) => p !== primary);
  for (let i = 0; i < remaining; i++) {
    const p = secondary[i % secondary.length]!;
    dist[p] += 1;
  }
  return dist;
}

function buildJobs(
  batch_id: string,
  size: number,
  distribution: Record<ProductionPriority, number>,
): ResumeJob[] {
  const jobs: ResumeJob[] = [];
  let index = 0;
  for (const priority of PRODUCTION_PRIORITIES) {
    const count = distribution[priority];
    for (let n = 0; n < count; n++) {
      index += 1;
      jobs.push({
        job_id: `job-${batch_id}-${String(index).padStart(3, "0")}`,
        batch_id,
        index,
        priority,
        tier: priority === "ats" || priority === "government" || priority === "engineering"
          ? "ats_safe"
          : "visual",
        status: "queued",
        worker_id: `resume-worker-${(index % 4) + 1}`,
        template_slug: `${priority}-resume-${batch_id}-${index}`,
        retry_count: 0,
      });
    }
  }
  return jobs.slice(0, size);
}

export function validateBatchPlan(plan: BatchPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (plan.jobs.length !== plan.size) {
    errors.push(`Job count ${plan.jobs.length} !== plan size ${plan.size}`);
  }
  if (plan.requested_by !== "founder") {
    errors.push("Batches must be founder-requested");
  }
  return { valid: errors.length === 0, errors };
}
