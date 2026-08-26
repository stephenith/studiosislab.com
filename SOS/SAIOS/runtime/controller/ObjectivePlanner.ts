/**
 * Objective planner — decide research, workers, jobs, batch size, priority, queue, pipeline.
 */
import { BATCH_SIZES } from "../directors/resume-production/types.js";
import type { InterpretedCommand, ObjectivePlan, WorkerAssignment } from "./types.js";

export function planObjective(command: InterpretedCommand): ObjectivePlan {
  const plan_id = `plan-${Date.now()}`;
  const job_count = command.intent === "analyze" ? 0 : command.count;
  const batch_size = normalizeBatchSize(job_count);
  const needs_research = command.requires_research && command.supported;
  const use_batch_director = job_count > 1;
  const use_queue = job_count >= 1 && command.intent !== "analyze";

  const workers = assignWorkers(command, job_count);

  const pipeline_stages = buildPipelineStages(command, needs_research);

  return {
    plan_id,
    objective: command.raw_objective,
    command,
    needs_research,
    workers,
    job_count,
    batch_size,
    priority: command.priority,
    use_queue,
    use_batch_director,
    pipeline_stages,
    research_topics: needs_research
      ? [
          "Resume Design Knowledge",
          "Resume Intelligence Engine",
          "Resume Learning Engine",
          "Existing template corpus",
          "Industry hiring trends",
        ]
      : [],
    estimated_duration_ms: estimateDuration(job_count, needs_research),
  };
}

function normalizeBatchSize(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 10;
  const allowed = [...BATCH_SIZES];
  return allowed.find((s) => s >= count) ?? allowed[allowed.length - 1]!;
}

function assignWorkers(command: InterpretedCommand, job_count: number): WorkerAssignment[] {
  if (command.intent === "analyze") {
    return [
      { worker_type: "resume-design-research-engine", role: "corpus_analysis", count: 1 },
    ];
  }

  const workers: WorkerAssignment[] = [];

  if (command.requires_research) {
    workers.push({ worker_type: "resume-design-research-engine", role: "design_brief", count: 1 });
  }

  if (command.product_type === "resume" && job_count > 0) {
    workers.push({
      worker_type: "resume-production-worker",
      role: "generation",
      count: job_count,
    });
    workers.push({ worker_type: "resume-qa-worker", role: "validation", count: job_count });
    workers.push({ worker_type: "local-review-tool", role: "founder_review", count: job_count });
    workers.push({ worker_type: "resume-learning-engine", role: "feedback_memory", count: 1 });
  }

  if (useBatchDirector(job_count)) {
    workers.unshift({
      worker_type: "resume-production-batch-director",
      role: "batch_orchestration",
      count: 1,
    });
  }

  return workers;
}

function useBatchDirector(job_count: number): boolean {
  return job_count > 1;
}

function buildPipelineStages(command: InterpretedCommand, needs_research: boolean): string[] {
  if (command.intent === "analyze") {
    return ["research", "report"];
  }

  const stages: string[] = [];
  if (needs_research) stages.push("research");
  if (command.job_count !== 0) {
    stages.push("queue", "pipeline", "qa", "review", "approval", "learning");
  }
  stages.push("report");
  return stages;
}

function estimateDuration(job_count: number, needs_research: boolean): number {
  const perJob = 400;
  const research = needs_research ? 200 : 0;
  return research + Math.max(job_count, 1) * perJob;
}
