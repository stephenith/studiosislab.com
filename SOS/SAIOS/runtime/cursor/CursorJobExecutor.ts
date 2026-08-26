import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { QueueManager } from "../queue/QueueManager.js";
import type { SaiosJob } from "../queue/types.js";
import { CursorRunner } from "./CursorRunner.js";
import { reportFilePath, resolveCursorPaths } from "./paths.js";
import type { CursorJobExecutionResult, CursorRunOutcome } from "./types.js";

export type CursorJobExecutorOptions = {
  queue: QueueManager;
  runner?: CursorRunner;
  reportsDir?: string;
  workspaceRoot?: string;
};

export class CursorJobExecutor {
  private readonly queue: QueueManager;
  private readonly runner: CursorRunner;
  private readonly reportsDir: string;

  constructor(options: CursorJobExecutorOptions) {
    this.queue = options.queue;
    const paths = resolveCursorPaths({ reportsDir: options.reportsDir });
    this.runner = options.runner ?? new CursorRunner({ workspaceRoot: options.workspaceRoot ?? paths.repoRoot });
    this.reportsDir = options.reportsDir ?? paths.reportsDir;
  }

  private async ensureRunning(job: SaiosJob): Promise<SaiosJob> {
    if (job.status === "QUEUED") {
      return this.queue.updateStatus(job.id, { status: "RUNNING", note: "cursor runner started" }, "cursor-runner");
    }
    if (job.status === "PLANNING") {
      return this.queue.updateStatus(job.id, { status: "RUNNING", note: "cursor runner started" }, "cursor-runner");
    }
    return job;
  }

  private async writeExecutionReport(job: SaiosJob, outcome: CursorRunOutcome): Promise<string> {
    await mkdir(this.reportsDir, { recursive: true });
    const absPath = reportFilePath(this.reportsDir, job.id);
    const payload = {
      job_id: job.id,
      title: job.title,
      worker_id: outcome.worker_id,
      launched: outcome.launched,
      ok: outcome.ok,
      exit_code: outcome.exit_code,
      duration_ms: outcome.duration_ms,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      output_preview: outcome.output_preview,
      error: outcome.error,
      finished_at: outcome.finished_at,
      report_path: outcome.report_path,
    };
    await writeFile(absPath, JSON.stringify(payload, null, 2), "utf8");
    return absPath;
  }

  /**
   * Execute one job via Cursor Agent CLI, write report, update queue.
   * Success → WAITING_QA. Failure → FAILED.
   */
  async execute(job: SaiosJob): Promise<CursorJobExecutionResult> {
    let current = await this.ensureRunning(job);
    const outcome = await this.runner.runJob(current);
    const absReportPath = await this.writeExecutionReport(current, outcome);
    const relReportPath = outcome.report_path;

    if (outcome.ok) {
      current = await this.queue.updateStatus(
        current.id,
        {
          status: "WAITING_QA",
          report_path: relReportPath,
          note: "cursor runner complete — awaiting QA",
        },
        "cursor-runner",
      );
    } else {
      current = await this.queue.updateStatus(
        current.id,
        {
          status: "FAILED",
          report_path: relReportPath,
          note: outcome.error ?? "cursor runner failed",
        },
        "cursor-runner",
      );
    }

    return {
      job: current,
      outcome: { ...outcome, report_path: relReportPath },
      report_written: existsSync(absReportPath),
    };
  }
}
