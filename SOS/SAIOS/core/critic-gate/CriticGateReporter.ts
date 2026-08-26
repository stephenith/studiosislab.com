/**
 * CriticGateReporter
 */
import type { CriticGateResult } from "./types.js";

export function buildGateReportMarkdown(gates: CriticGateResult[]): string {
  const lines = [
    `# Critic Gate Report`,
    ``,
    `- gates: ${gates.length}`,
    `- dry_run: true`,
    `- publication_allowed: always false`,
    ``,
  ];
  for (const g of gates.slice(-20)) {
    lines.push(
      `- \`${g.gate_id}\` · ${g.ready ? "PASS" : "BLOCKED"} · ${g.candidate_title} · Overall ${g.overall_score} · ATS ${g.ats_score}`,
    );
  }
  lines.push(``);
  return lines.join("\n");
}
