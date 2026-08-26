/**
 * Founder decision reports — Agent #125.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { FounderDecision } from "./types.js";
import { decisionsDir } from "./FounderReviewRepository.js";

export class DecisionReporter {
  writeMarkdown(decisions: FounderDecision[], root?: string): string {
    const dir = decisionsDir(root);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "founder-decision-report.md");
    const real = decisions.filter((d) => !d.fixture);
    const md = `# Founder Decision Report

**Generated:** ${new Date().toISOString()}  
**Real decisions:** ${real.length}  
**Fixtures excluded from learning:** ${decisions.filter((d) => d.fixture).length}

## Rules

- Immutable after create
- publication_allowed always false in V1
- LIVE OFF / dry_run only
- Actual first dry-run review remains undecided until Stephen acts in the dashboard

## Decisions

${real.length === 0 ? "_No real founder decisions recorded yet._" : real.map((d) => `- \`${d.decision_id}\` · ${d.decision} · review=${d.review_id} · next=${d.next_action}`).join("\n")}
`;
    writeFileSync(path, `${md}\n`);
    return path;
  }
}
