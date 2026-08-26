/**
 * WorkerRuntimeReporter — Agent #182.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { WorkerRuntimeRepository } from "./WorkerRuntimeRepository.js";

export class WorkerRuntimeReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: WorkerRuntimeRepository): string {
    const health = repo.buildHealth();
    const listLines = repo.listRuntimes().map(
      (r) =>
        `- ${r.worker_runtime_id} · ${r.worker_id} · ${r.department_id} · ${r.status}${r.fixture ? " · fixture" : ""}`,
    );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "WORKER_RUNTIME_LOG.md",
      title: "Worker Runtime Contract Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: worker_runtime_contracts_only · worker_spawn=false · execution_allowed=false · LIVE OFF`,
        "",
        `Runtimes: ${health.runtime_count}`,
        `Assignments: ${health.assignment_count}`,
        `Sessions: ${health.session_count}`,
        "",
      ],
      listHeading: "Worker Runtimes",
      listLines,
    });
  }
}
