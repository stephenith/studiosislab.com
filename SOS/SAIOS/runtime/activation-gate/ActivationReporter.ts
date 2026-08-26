/**
 * ActivationReporter — Agent #185.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { ActivationRepository } from "./ActivationRepository.js";

export class ActivationReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: ActivationRepository): string {
    const health = repo.buildHealth();
    const listLines = repo.listActivations().map(
      (a) =>
        `- ${a.activation_id} · ${a.mission_id} · ${a.status}/${a.outcome ?? "n/a"} · score=${a.overall_score}${a.fixture ? " · fixture" : ""}`,
    );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "ACTIVATION_GATE_LOG.md",
      title: "Activation Gate Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: activation_eligibility_only · execution=false · LIVE OFF`,
        "",
        `Activations: ${health.activation_count}`,
        `Eligible: ${health.eligible_count}`,
        `Blocked: ${health.blocked_count}`,
        `Certificates: ${health.certificate_count}`,
        "",
      ],
      listHeading: "Activation Records",
      listLines,
    });
  }
}
