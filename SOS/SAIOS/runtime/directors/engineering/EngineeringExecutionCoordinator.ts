import type { CursorJobExecutor } from "../../cursor/CursorJobExecutor.js";
import type { SaiosJob } from "../../queue/types.js";
import type { FactoryWorker } from "../../workers/WorkerDefinition.js";
import { assertAllowedDirectorAction } from "./EngineeringPolicies.js";
import {
  buildEngineeringExecutionReport,
  writeEngineeringExecutionReport,
  type EngineeringExecutionReport,
} from "./EngineeringExecutionReport.js";
import {
  buildWorkerExecutionContext,
  jobWithExecutionContext,
  type WorkerExecutionInput,
} from "./WorkerExecutionContext.js";
import { buildEngineeringCursorPrompt, isVerificationWorkerType } from "../../cursor/EngineeringCursorAdapter.js";

export type EngineeringExecutionCoordinatorOptions = {
  cursorExecutor: CursorJobExecutor;
  executionReportsDir?: string;
};

/**
 * Connects Engineering Director delegated jobs to the existing Cursor Runner API.
 * Never spawns processes or calls Cursor directly — delegates to CursorJobExecutor.
 */
export class EngineeringExecutionCoordinator {
  private readonly cursorExecutor: CursorJobExecutor;
  private readonly executionReportsDir?: string;

  constructor(options: EngineeringExecutionCoordinatorOptions) {
    this.cursorExecutor = options.cursorExecutor;
    this.executionReportsDir = options.executionReportsDir;
  }

  createExecutionContext(input: WorkerExecutionInput) {
    assertAllowedDirectorAction("create_execution_context");
    const context = buildWorkerExecutionContext(input);
    context.prompt = buildEngineeringCursorPrompt(context);
    return context;
  }

  /**
   * Execute one assigned engineering job through CursorJobExecutor.
   */
  async executeAssignedJob(
    worker: FactoryWorker | WorkerExecutionInput["worker"],
    job: SaiosJob,
    options?: { prompt_override?: string },
  ): Promise<EngineeringExecutionReport> {
    assertAllowedDirectorAction("delegate_cursor_execution");

    const startedAt = new Date().toISOString();
    const context = this.createExecutionContext({
      worker,
      job,
      prompt_override: options?.prompt_override,
    });

    const prepared = jobWithExecutionContext(
      { ...job, assigned_worker: job.assigned_worker ?? context.worker.worker_id },
      context,
    );

    const result = await this.cursorExecutor.execute(prepared);

    const report = buildEngineeringExecutionReport({
      job_id: job.id,
      worker_id: context.worker.worker_id,
      cursor_run_id: context.cursor_run_id,
      started_at: startedAt,
      outcome: result.outcome,
      verification_requested: isVerificationWorkerType(context.worker.worker_type),
      output_dir: context.output_dir,
    });

    await writeEngineeringExecutionReport(report, this.executionReportsDir);
    return report;
  }
}
