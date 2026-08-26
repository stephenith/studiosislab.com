/**
 * SystemReadinessReporter — markdown summary (Agent #171).
 * Platform consolidation (Agent #173): BaseMarkdownReporter.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { SystemReadinessRepository } from "./SystemReadinessRepository.js";

export class SystemReadinessReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: SystemReadinessRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const certs = repo.list();
    const listLines = certs
      .slice(-20)
      .reverse()
      .map(
        (c) =>
          `- ${c.validated_at} · ${c.certificate_id} · ${c.mission_id} · ${c.certificate_status} · score ${c.readiness_score}${c.fixture ? " · fixture" : ""}`,
      );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "SYSTEM_READINESS_LOG.md",
      title: "System Readiness Freeze Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: readiness_freeze_only · execution_allowed=false · LIVE OFF`,
        "",
        `Certificates: ${health?.certificate_count ?? certs.length}`,
        `Ready: ${health?.ready_count ?? 0}`,
        `Blocked: ${health?.blocked_count ?? 0}`,
        "",
        latest
          ? `Latest: ${latest.mission_id} · ${latest.certificate_status} · score ${latest.readiness_score ?? "—"}`
          : "Latest: none",
      ],
      listHeading: "Certificates",
      listLines,
    });
  }
}
