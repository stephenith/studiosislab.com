/**
 * Deployment readiness verify — read-only.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runDeploymentReadinessAudit } from "./DeploymentReadinessDirector.js";
import { READINESS_ROOT } from "./paths.js";

const REQUIRED = [
  "deployment-readiness.json",
  "deployment-checklist.md",
  "deployment-risks.json",
  "deployment-score.json",
  "deployment-summary.md",
  "server-requirements.md",
  "resource-estimate.md",
];

function main(): void {
  const result = runDeploymentReadinessAudit();
  const reportsOk = REQUIRED.every((f) =>
    existsSync(join(READINESS_ROOT, f)),
  );

  const checks = {
    deployment_readiness: result.checks_summary.deployment_readiness && reportsOk,
    infrastructure_readiness: result.checks_summary.infrastructure_readiness,
    runtime_readiness: result.checks_summary.runtime_readiness,
    publication_readiness: result.checks_summary.publication_readiness,
    recovery_readiness: result.checks_summary.recovery_readiness,
    founder_safety: result.checks_summary.founder_safety,
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log(
    [
      "Deployment Readiness Verify",
      "===========================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Score: ${result.score_pct}% (${result.score}/${result.max_score})`,
      `Risks: ${result.risks.length}`,
      `VPS recommended: ${result.vps.recommended.cpu} / ${result.vps.recommended.ram}`,
      `Est. monthly: $${result.vps.recommended.estimated_monthly_usd[0]}–$${result.vps.recommended.estimated_monthly_usd[1]}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main();
