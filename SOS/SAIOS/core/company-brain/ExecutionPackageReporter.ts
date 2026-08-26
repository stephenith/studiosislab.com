/**
 * ExecutionPackageReporter — markdown summary (Agent #165).
 * Platform consolidation (Agent #176): BaseMarkdownReporter.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { ExecutionPackageRepository } from "./ExecutionPackageRepository.js";

export class ExecutionPackageReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: ExecutionPackageRepository): string {
    const latest = repo.loadLatest();
    const snap = repo.loadSnapshot();
    const headerLines = [
      `Updated: ${new Date().toISOString()}`,
      `Mode: dry_run · execution_allowed=false · enqueue=false · publish=false`,
      "",
      `Packages: ${snap?.package_count ?? 0}`,
      latest
        ? `Latest: ${latest.package_id} · mission ${latest.mission_id} · ${latest.execution_id}`
        : "Latest: none",
    ];
    const stageLines = latest
      ? latest.execution_graph.nodes.map(
          (n) => `- ${n.order}. ${n.label} · executed=${n.executed}`,
        )
      : [];
    const gateLines = latest
      ? latest.quality_gates.map(
          (g) =>
            `- ${g.label}: ${g.satisfied === null ? "pending" : String(g.satisfied)}`,
        )
      : [];
    const sections = [
      { lines: headerLines },
      { heading: "Stages (not executed)", lines: stageLines },
    ];
    if (latest) {
      sections.push({ heading: "Quality gates", lines: gateLines });
    }
    return this.base.write(
      repo.dir,
      "EXECUTION_PACKAGE_LOG.md",
      "Execution Package Dry-Run Log",
      sections,
    );
  }
}
