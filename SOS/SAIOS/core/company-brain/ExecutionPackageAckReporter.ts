/**
 * ExecutionPackageAckReporter — markdown summary (Agent #166).
 * Platform consolidation (Agent #176): BaseMarkdownReporter.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { ExecutionPackageAckRepository } from "./ExecutionPackageAckRepository.js";

export class ExecutionPackageAckReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: ExecutionPackageAckRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const acks = repo.listAcknowledgements();
    const listLines = acks
      .slice(-20)
      .reverse()
      .map(
        (a) =>
          `- ${a.created_at} · ${a.acknowledgement_id} · ${a.mission_id} · pkg v${a.execution_package_version} · ${a.decision} · ${a.status}${a.fixture ? " · fixture" : ""}`,
      );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "EXECUTION_PACKAGE_ACK_LOG.md",
      title: "Execution Package Acknowledgement Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: acknowledgement_only · execution_allowed=false · enqueue=false · publish=false`,
        "",
        `Pending: ${health?.pending_count ?? 0}`,
        `Acknowledged: ${health?.acknowledged_count ?? 0}`,
        `Changes requested: ${health?.changes_requested_count ?? 0}`,
        `Rejected: ${health?.rejected_count ?? 0}`,
        "",
        latest
          ? `Latest: ${latest.mission_id} · ${latest.ack_status} · ${latest.checksum?.slice(0, 12) ?? "—"}…`
          : "Latest: none",
      ],
      listHeading: "Acknowledgements",
      listLines,
    });
  }
}
