/**
 * RuntimeReleaseReporter — markdown summary (Agent #170).
 * Platform consolidation (Agent #173): BaseMarkdownReporter.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { RuntimeReleaseRepository } from "./RuntimeReleaseRepository.js";

export class RuntimeReleaseReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: RuntimeReleaseRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const decisions = repo.listDecisions();
    const listLines = decisions
      .slice(-20)
      .reverse()
      .map(
        (d) =>
          `- ${d.created_at} · ${d.release_id} · ${d.mission_id} · ${d.decision} · ${d.status}${d.fixture ? " · fixture" : ""}`,
      );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "RUNTIME_RELEASE_LOG.md",
      title: "Runtime Release Gate Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: release_gate_only · execution_allowed=false · dispatch_allowed=false · LIVE OFF`,
        "",
        `Pending: ${health?.pending_count ?? 0}`,
        `Approved: ${health?.approved_count ?? 0}`,
        `Rejected: ${health?.rejected_count ?? 0}`,
        `Changes requested: ${health?.changes_requested_count ?? 0}`,
        "",
        latest
          ? `Latest: ${latest.mission_id} · ${latest.release_status} · ${latest.plan_checksum?.slice(0, 12) ?? "—"}…`
          : "Latest: none",
      ],
      listHeading: "Decisions",
      listLines,
    });
  }
}
