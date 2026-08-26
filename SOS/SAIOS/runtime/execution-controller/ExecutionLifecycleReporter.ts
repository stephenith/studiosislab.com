/**
 * ExecutionLifecycleReporter — markdown summary (Agent #179).
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { ExecutionControllerRepository } from "./ExecutionControllerRepository.js";

export class ExecutionLifecycleReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: ExecutionControllerRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const records = repo.list();
    const listLines = records
      .slice(-20)
      .reverse()
      .map(
        (r) =>
          `- ${r.updated_at} · ${r.controller_id} · ${r.mission_id} · ${r.controller_status}${r.fixture ? " · fixture" : ""}`,
      );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "EXECUTION_CONTROLLER_LOG.md",
      title: "Execution Controller Scaffold Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: controller_scaffold_only · execution_allowed=false · LIVE OFF`,
        "",
        `Records: ${health?.record_count ?? records.length}`,
        `Ready: ${health?.ready_count ?? 0}`,
        `Pending: ${health?.pending_count ?? 0}`,
        `Blocked: ${health?.blocked_count ?? 0}`,
        "",
        latest
          ? `Latest: ${latest.mission_id} · ${latest.controller_status} · ${latest.controller_id}`
          : "Latest: none",
      ],
      listHeading: "Controllers",
      listLines,
    });
  }
}
