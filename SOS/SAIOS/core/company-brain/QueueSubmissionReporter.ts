/**
 * QueueSubmissionReporter — markdown summary (Agent #167).
 * Platform consolidation (Agent #176): BaseMarkdownReporter.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { QueueSubmissionRepository } from "./QueueSubmissionRepository.js";

export class QueueSubmissionReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: QueueSubmissionRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const packages = repo.list();
    const listLines = packages
      .slice(-20)
      .reverse()
      .map(
        (p) =>
          `- ${p.created_at} · ${p.submission_id} · ${p.mission_id} · pkg ${p.execution_package_id} · ack ${p.acknowledgement_id} · ${p.submission_checksum.slice(0, 12)}…${p.fixture ? " · fixture" : ""}`,
      );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "QUEUE_SUBMISSION_LOG.md",
      title: "Queue Submission Contract Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: shadow_submission_only · dry_run=true · queue_insert_allowed=false · execution_allowed=false · publishing_allowed=false`,
        "",
        `Pending: ${health?.pending_count ?? 0}`,
        `Ready (shadow): ${health?.ready_count ?? 0}`,
        `Blocked: ${health?.blocked_count ?? 0}`,
        `Packages: ${health?.package_count ?? packages.length}`,
        "",
        latest
          ? `Latest: ${latest.mission_id} · ${latest.submission_status} · ${latest.submission_checksum?.slice(0, 12) ?? "—"}…`
          : "Latest: none",
      ],
      listHeading: "Submission packages",
      listLines,
    });
  }
}
