/**
 * FounderGateReporter
 */
import type { CycleCheckpoint } from "./types.js";

export function buildFounderGateReport(waiting: CycleCheckpoint[]): string {
  return [
    `# Founder Gate Runtime Report`,
    ``,
    `- waiting_cycles: ${waiting.length}`,
    `- dry_run: true`,
    `- publication_allowed: false`,
    `- decision_mode: dashboard_manual`,
    ``,
    ...waiting.map(
      (w) =>
        `- \`${w.cycle_id}\` · ${w.candidate_title} · review=${w.review_id} · state=${w.state}`,
    ),
    ``,
  ].join("\n");
}
