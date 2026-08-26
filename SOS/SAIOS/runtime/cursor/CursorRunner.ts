import type { SaiosJob } from "../queue/types.js";
import { runCursorAgentPrint } from "./CursorProcess.js";
import { CursorResultParser } from "./CursorResultParser.js";
import { resolveCursorPaths } from "./paths.js";
import type { CursorRunOutcome, CursorRunRequest } from "./types.js";

function buildPromptFromJob(job: SaiosJob): string {
  const metaPrompt = job.metadata?.prompt;
  if (typeof metaPrompt === "string" && metaPrompt.trim()) {
    return metaPrompt.trim();
  }
  const parts = [job.title.trim(), job.description.trim()].filter(Boolean);
  return parts.join("\n\n");
}

export class CursorRunner {
  private readonly parser: CursorResultParser;
  private readonly defaultWorkspace: string;
  private readonly defaultTimeoutMs: number;

  constructor(options?: { workspaceRoot?: string; timeoutMs?: number }) {
    this.parser = new CursorResultParser();
    this.defaultWorkspace = options?.workspaceRoot ?? resolveCursorPaths().repoRoot;
    this.defaultTimeoutMs = options?.timeoutMs ?? 600_000;
  }

  buildPrompt(job: SaiosJob): string {
    return buildPromptFromJob(job);
  }

  async run(request: CursorRunRequest): Promise<CursorRunOutcome> {
    const process = await runCursorAgentPrint({
      workspace: request.workspace_root,
      prompt: request.prompt,
      force: request.force,
      timeoutMs: request.timeout_ms ?? this.defaultTimeoutMs,
    });

    const parsed = this.parser.parse(process);
    const report_path = `SOS/07_LOGS/saios/reports/${request.job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;

    return {
      job_id: request.job.id,
      worker_id: request.job.assigned_worker,
      launched: process.launched,
      ok: parsed.ok,
      exit_code: parsed.exit_code,
      stdout: parsed.stdout,
      stderr: parsed.stderr,
      duration_ms: parsed.duration_ms,
      output_preview: parsed.output_preview,
      report_path,
      error: parsed.error,
      finished_at: new Date().toISOString(),
    };
  }

  async runJob(job: SaiosJob, options?: { workspace_root?: string; force?: boolean }): Promise<CursorRunOutcome> {
    return this.run({
      job,
      prompt: this.buildPrompt(job),
      workspace_root: options?.workspace_root ?? this.defaultWorkspace,
      force: options?.force,
    });
  }
}
