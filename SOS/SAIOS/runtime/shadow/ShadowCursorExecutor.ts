import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { QueueManager } from "../queue/QueueManager.js";
import type { SaiosJob } from "../queue/types.js";
import type { CursorExecutorLike } from "../runtime-types.js";
import { reportFilePath } from "../cursor/paths.js";
import { shadowWorkspaceRel } from "./paths.js";

export function buildShadowPrompt(runId: string, job: SaiosJob): string {
  const workspace = shadowWorkspaceRel(runId);
  const base =
    typeof job.metadata?.prompt === "string"
      ? job.metadata.prompt
      : `${job.title}\n\n${job.description}`;

  return [
    "SHADOW MODE — observation only.",
    `You may ONLY create or modify files inside: ${workspace}/`,
    "Do NOT modify src/, StudiosisLab product code, SOS/runtime/, or any path outside the shadow workspace.",
    "",
    "Task:",
    base,
  ].join("\n");
}

export class ShadowCursorExecutor implements CursorExecutorLike {
  private readonly queue: QueueManager;
  private readonly reportsDir: string;
  private readonly workspaceDir: string;
  private readonly runId: string;

  constructor(options: {
    queue: QueueManager;
    reportsDir: string;
    workspaceDir: string;
    runId: string;
  }) {
    this.queue = options.queue;
    this.reportsDir = options.reportsDir;
    this.workspaceDir = options.workspaceDir;
    this.runId = options.runId;
  }

  async execute(job: SaiosJob) {
    const prompt = buildShadowPrompt(this.runId, job);
    let current = job;

    if (current.status === "QUEUED" || current.status === "PLANNING") {
      current = await this.queue.updateStatus(
        job.id,
        { status: "RUNNING", note: "shadow cursor run" },
        "shadow-cursor-runner",
      );
    }

    await mkdir(this.workspaceDir, { recursive: true });
    await mkdir(this.reportsDir, { recursive: true });

    const artifactName = `${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    const artifactAbs = join(this.workspaceDir, artifactName);
    await writeFile(
      artifactAbs,
      `# Shadow artifact\n\n${prompt.slice(0, 500)}\n`,
      "utf8",
    );

    const relReport = `SOS/07_LOGS/saios/shadow/${this.runId}/reports/${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    await writeFile(
      reportFilePath(this.reportsDir, job.id),
      JSON.stringify({
        job_id: job.id,
        ok: true,
        shadow: true,
        run_id: this.runId,
        workspace: shadowWorkspaceRel(this.runId),
        artifact: artifactName,
        prompt_preview: prompt.slice(0, 300),
        finished_at: new Date().toISOString(),
      }),
      "utf8",
    );

    current = await this.queue.updateStatus(
      job.id,
      {
        status: "WAITING_QA",
        report_path: relReport,
        note: "shadow cursor complete",
        artifacts: [
          {
            kind: "shadow-artifact",
            path: join(shadowWorkspaceRel(this.runId), artifactName),
            created_at: new Date().toISOString(),
          },
        ],
      },
      "shadow-cursor-runner",
    );

    return {
      job: current,
      outcome: { ok: true, report_path: relReport, error: null },
      report_written: true,
    };
  }
}
