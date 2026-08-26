/**
 * ExecutionAuthorizationReporter — Agent #186.
 */
import { BaseMarkdownReporter } from "../../platform/reporters/BaseMarkdownReporter.js";
import type { ExecutionAuthorizationRepository } from "./ExecutionAuthorizationRepository.js";

export class ExecutionAuthorizationReporter {
  private readonly base = new BaseMarkdownReporter();

  writeMarkdown(repo: ExecutionAuthorizationRepository): string {
    const health = repo.buildHealth();
    const listLines = repo.listAuthorizations().map(
      (a) =>
        `- ${a.authorization_id} · ${a.mission_id} · ${a.status}/${a.outcome ?? "n/a"} · founder=${a.founder}${a.fixture ? " · fixture" : ""}`,
    );
    return this.base.writeSimple({
      dir: repo.dir,
      filename: "EXECUTION_AUTHORIZATION_LOG.md",
      title: "Execution Authorization Log",
      headerLines: [
        `Updated: ${new Date().toISOString()}`,
        `Mode: founder_intent_only · execution=false · LIVE OFF · does not override Activation Gate`,
        "",
        `Authorizations: ${health.authorization_count}`,
        `Authorized: ${health.authorized_count}`,
        `Rejected: ${health.rejected_count}`,
        `Certificates: ${health.certificate_count}`,
        "",
      ],
      listHeading: "Authorization Records",
      listLines,
    });
  }
}
