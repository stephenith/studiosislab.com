/**
 * SimulationReporter — Agent #187.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { SimulationRepository } from "./SimulationRepository.js";

export class SimulationReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: SimulationRepository): string {
    const health = repo.buildHealth();
    const listLines = repo.listSimulations().map(
      (s) =>
        `- ${s.simulation_id} · ${s.mission_id} · ${s.status} · readiness=${s.overall_readiness ?? "n/a"}${s.fixture ? " · fixture" : ""}`,
    );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "PRE_DISPATCH_SIMULATION_LOG.md",
      title: "Pre-Dispatch Simulation Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: pre_dispatch_simulation_only · execution=false · LIVE OFF`,
        "",
        `Simulations: ${health.simulation_count}`,
        `Complete: ${health.complete_count}`,
        `Certificates: ${health.certificate_count}`,
        "",
      ],
      listHeading: "Simulations",
      listLines,
    });
  }
}
