/**
 * Persist readiness reports (read-only audit outputs).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { READINESS_ROOT } from "./paths.js";
import type { DeploymentReadinessResult } from "./types.js";

export function writeReadinessReports(result: DeploymentReadinessResult): void {
  writeFileSync(
    join(READINESS_ROOT, "deployment-readiness.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        score_pct: result.score_pct,
        score: result.score,
        max_score: result.max_score,
        checks_summary: result.checks_summary,
        pass_count: result.checks.filter((c) => c.pass).length,
        fail_count: result.checks.filter((c) => !c.pass).length,
        risk_count: result.risks.length,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(READINESS_ROOT, "deployment-score.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        score: result.score,
        max_score: result.max_score,
        score_pct: result.score_pct,
        breakdown: result.breakdown,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(READINESS_ROOT, "deployment-risks.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        risks: result.risks,
      },
      null,
      2,
    ),
  );

  const checklist = [
    `# Deployment Checklist`,
    ``,
    `Agent #113 — read-only readiness audit.`,
    ``,
    `**Score:** ${result.score_pct}% (${result.score}/${result.max_score})`,
    ``,
    ...result.checks.map(
      (c) =>
        `- [${c.pass ? "x" : " "}] **${c.label}** (${c.category}) — ${c.detail}`,
    ),
    ``,
  ].join("\n");
  writeFileSync(join(READINESS_ROOT, "deployment-checklist.md"), checklist);

  const summary = [
    `# Deployment Summary`,
    ``,
    `## Verdict: ${result.status}`,
    ``,
    `- Score: **${result.score_pct}%**`,
    `- Checks: ${result.checks.filter((c) => c.pass).length}/${result.checks.length} pass`,
    `- Risks: ${result.risks.length}`,
    `- LIVE enabled: **no** (safe)`,
    ``,
    `## Category scores`,
    ``,
    ...result.breakdown.map(
      (b) =>
        `- **${b.category}**: ${b.score}/${b.max} (${b.pass_count} pass / ${b.fail_count} fail)`,
    ),
    ``,
    `## Top risks`,
    ``,
    ...result.risks
      .slice(0, 8)
      .map((r) => `- [${r.level}] ${r.title} — ${r.mitigation}`),
    ``,
    `## VPS`,
    ``,
    `- Recommended: ${result.vps.recommended.label} · ${result.vps.recommended.cpu} / ${result.vps.recommended.ram} / ${result.vps.recommended.disk}`,
    `- Est. monthly: $${result.vps.recommended.estimated_monthly_usd[0]}–$${result.vps.recommended.estimated_monthly_usd[1]}`,
    ``,
  ].join("\n");
  writeFileSync(join(READINESS_ROOT, "deployment-summary.md"), summary);

  const server = [
    `# Server Requirements`,
    ``,
    `| Item | Minimum | Recommended |`,
    `|---|---|---|`,
    `| CPU | ${result.vps.minimum.cpu} | ${result.vps.recommended.cpu} |`,
    `| RAM | ${result.vps.minimum.ram} | ${result.vps.recommended.ram} |`,
    `| Disk | ${result.vps.minimum.disk} | ${result.vps.recommended.disk} |`,
    `| Bandwidth | ${result.vps.minimum.bandwidth} | ${result.vps.recommended.bandwidth} |`,
    `| Node | ${result.vps.node_version} | ${result.vps.node_version} |`,
    `| Ubuntu | ${result.vps.ubuntu_version} | ${result.vps.ubuntu_version} |`,
    ``,
    `## Stack`,
    ``,
    `- PM2 or systemd`,
    `- Nginx reverse proxy`,
    `- Git`,
    `- No Kubernetes`,
    ``,
  ].join("\n");
  writeFileSync(join(READINESS_ROOT, "server-requirements.md"), server);

  const resources = [
    `# Resource Estimate`,
    ``,
    `## Monthly cost`,
    ``,
    `- Minimum VPS: **$${result.vps.minimum.estimated_monthly_usd[0]}–$${result.vps.minimum.estimated_monthly_usd[1]} / mo**`,
    `- Recommended VPS: **$${result.vps.recommended.estimated_monthly_usd[0]}–$${result.vps.recommended.estimated_monthly_usd[1]} / mo**`,
    ``,
    `## Capacity`,
    ``,
    result.vps.estimated_capacity,
    ``,
    `## Notes`,
    ``,
    ...result.vps.notes.map((n) => `- ${n}`),
    ``,
  ].join("\n");
  writeFileSync(join(READINESS_ROOT, "resource-estimate.md"), resources);
}
