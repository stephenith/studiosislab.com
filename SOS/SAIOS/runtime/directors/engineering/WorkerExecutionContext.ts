import { randomBytes } from "node:crypto";
import type { Priority } from "../../shared/types.js";
import type { SaiosJob } from "../../queue/types.js";
import type { FactoryWorker } from "../../workers/WorkerDefinition.js";
import { resolveEngineeringPaths } from "./paths.js";

export type ExecutionMode = "cursor-agent" | "dry-run";

export type WorkerExecutionContext = {
  worker: {
    worker_id: string;
    worker_type: string;
    display_name: string;
    capabilities: string[];
    priority: Priority;
    parent_director: string | null;
  };
  job: SaiosJob;
  priority: Priority;
  workspace: string;
  execution_mode: ExecutionMode;
  model: string | null;
  retry_count: number;
  output_dir: string;
  prompt: string;
  cursor_run_id: string;
};

export type WorkerExecutionInput = {
  worker: FactoryWorker | WorkerExecutionContext["worker"];
  job: SaiosJob;
  execution_mode?: ExecutionMode;
  model?: string | null;
  retry_count?: number;
  prompt_override?: string;
};

function generateCursorRunId(): string {
  const suffix = randomBytes(4).toString("hex");
  return `CURSOR-RUN-${Date.now()}-${suffix}`;
}

export function buildWorkerExecutionContext(input: WorkerExecutionInput): WorkerExecutionContext {
  const paths = resolveEngineeringPaths();
  const worker =
    "worker_id" in input.worker
      ? {
          worker_id: input.worker.worker_id,
          worker_type: input.worker.worker_type,
          display_name: input.worker.display_name,
          capabilities: [...input.worker.capabilities],
          priority: input.worker.priority,
          parent_director: input.worker.parent_director,
        }
      : input.worker;

  const outputDir = `SOS/07_LOGS/saios/directors/engineering/execution/${input.job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const priority = input.job.priority ?? worker.priority;

  const defaultPrompt = [
    `Engineering task for ${worker.display_name} (${worker.worker_type}).`,
    `You may ONLY create or modify files inside: ${outputDir}/`,
    "Do NOT modify src/, product code, or SOS/runtime/.",
    "",
    "Task:",
    input.job.description || input.job.title,
  ].join("\n");

  return {
    worker,
    job: input.job,
    priority,
    workspace: paths.repoRoot,
    execution_mode: input.execution_mode ?? "cursor-agent",
    model: input.model ?? null,
    retry_count: input.retry_count ?? 0,
    output_dir: outputDir,
    prompt: input.prompt_override ?? defaultPrompt,
    cursor_run_id: generateCursorRunId(),
  };
}

export function jobWithExecutionContext(
  job: SaiosJob,
  context: WorkerExecutionContext,
): SaiosJob {
  return {
    ...job,
    assigned_worker: job.assigned_worker ?? context.worker.worker_id,
    metadata: {
      ...job.metadata,
      prompt: context.prompt,
      engineering_execution: true,
      cursor_run_id: context.cursor_run_id,
      worker_type: context.worker.worker_type,
      output_dir: context.output_dir,
      execution_mode: context.execution_mode,
    },
  };
}
