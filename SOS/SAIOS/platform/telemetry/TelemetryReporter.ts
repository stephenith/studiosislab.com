/**
 * TelemetryReporter — Agent #183.
 */
import { BaseMarkdownReporter } from "../reporters/BaseMarkdownReporter.js";
import type { TelemetryRepository } from "./TelemetryRepository.js";

export class TelemetryReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: TelemetryRepository): string {
    const health = repo.buildHealth();
    const listLines = repo.listSessions().map(
      (s) =>
        `- ${s.telemetry_session_id} · ${s.mission_id} · ${s.status}${s.fixture ? " · fixture" : ""}`,
    );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "TELEMETRY_REGISTRY_LOG.md",
      title: "Telemetry Contract Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: telemetry_contracts_only · collection=false · emission=false · LIVE OFF`,
        "",
        `Sessions: ${health.session_count}`,
        `Timelines: ${health.timeline_count}`,
        `Correlations: ${health.correlation_count}`,
        "",
      ],
      listHeading: "Telemetry Sessions",
      listLines,
    });
  }
}
