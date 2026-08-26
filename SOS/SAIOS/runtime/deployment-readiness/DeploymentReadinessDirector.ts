/**
 * Deployment Readiness Audit director — read-only.
 * AGENT #113
 */
import { runAllChecks } from "./ReadinessAuditor.js";
import { ensureReadinessRoot, READINESS_ROOT } from "./paths.js";
import { writeReadinessReports } from "./ReadinessReporter.js";
import {
  buildVpsRecommendation,
  deriveRisks,
  scoreChecks,
} from "./Scoring.js";
import type { DeploymentReadinessResult } from "./types.js";

export function runDeploymentReadinessAudit(): DeploymentReadinessResult {
  const generated_at = new Date().toISOString();
  ensureReadinessRoot();

  const checks = runAllChecks();
  const { score, max_score, score_pct, breakdown } = scoreChecks(checks);
  const risks = deriveRisks(checks);
  const vps = buildVpsRecommendation();

  const checks_summary = {
    deployment_readiness: score_pct >= 80,
    infrastructure_readiness: breakdown
      .filter((b) => b.category === "infrastructure")
      .every((b) => b.fail_count === 0),
    runtime_readiness: breakdown
      .filter((b) => b.category === "runtime")
      .every((b) => b.score / b.max >= 0.85),
    publication_readiness: breakdown
      .filter((b) => b.category === "publication")
      .every((b) => b.fail_count === 0),
    recovery_readiness: breakdown
      .filter((b) => b.category === "recovery")
      .every((b) => b.fail_count === 0),
    founder_safety: breakdown
      .filter((b) => b.category === "founder_safety")
      .every((b) => b.fail_count === 0),
  };

  let status: DeploymentReadinessResult["status"] = "READY";
  if (score_pct < 90) status = "DEGRADED";
  if (score_pct < 70 || risks.some((r) => r.level === "CRITICAL")) {
    status = "BLOCKED";
  }

  const result: DeploymentReadinessResult = {
    generated_at,
    status,
    score,
    max_score,
    score_pct,
    checks,
    risks,
    breakdown,
    vps,
    checks_summary,
    output_dir: READINESS_ROOT,
  };

  writeReadinessReports(result);
  return result;
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("DeploymentReadinessDirector.ts") ||
    process.argv[1].endsWith("DeploymentReadinessDirector.js") ||
    process.argv[1].endsWith("index.ts"));

if (isMain && process.argv[1]?.includes("DeploymentReadinessDirector")) {
  const result = runDeploymentReadinessAudit();
  console.log(
    JSON.stringify(
      {
        status: result.status,
        score_pct: result.score_pct,
        risks: result.risks.length,
      },
      null,
      2,
    ),
  );
}
