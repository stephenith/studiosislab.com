/**
 * Persist deployment artifacts (JSON + scripts + markdown).
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEPLOYMENT_MANAGER_ROOT } from "./DeploymentConfiguration.js";
import type { DeploymentManagerResult } from "./types.js";

export function writeDeploymentReports(
  result: DeploymentManagerResult,
  scripts: { startup: string; shutdown: string; restart: string },
): void {
  mkdirSync(DEPLOYMENT_MANAGER_ROOT, { recursive: true });

  writeFileSync(
    join(DEPLOYMENT_MANAGER_ROOT, "deployment-plan.json"),
    JSON.stringify(result.plan, null, 2),
  );
  writeFileSync(
    join(DEPLOYMENT_MANAGER_ROOT, "deployment-bundle.json"),
    JSON.stringify(result.bundle, null, 2),
  );
  writeFileSync(
    join(DEPLOYMENT_MANAGER_ROOT, "startup-order.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        startup_order: result.plan.startup_order,
        shutdown_order: result.plan.shutdown_order,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(DEPLOYMENT_MANAGER_ROOT, "environment-check.json"),
    JSON.stringify(result.environment, null, 2),
  );

  const startupPath = join(DEPLOYMENT_MANAGER_ROOT, "startup.sh");
  const shutdownPath = join(DEPLOYMENT_MANAGER_ROOT, "shutdown.sh");
  const restartPath = join(DEPLOYMENT_MANAGER_ROOT, "restart.sh");
  writeFileSync(startupPath, scripts.startup);
  writeFileSync(shutdownPath, scripts.shutdown);
  writeFileSync(restartPath, scripts.restart);
  try {
    chmodSync(startupPath, 0o755);
    chmodSync(shutdownPath, 0o755);
    chmodSync(restartPath, 0o755);
  } catch {
    // chmod may fail on some FS — non-blocking
  }

  const report = [
    `# Deployment Manager Report`,
    ``,
    `AI OS deployment layer — Agent #106.`,
    `Turns Runtime Manager + departments into one deployable system.`,
    `No Docker / VPS provisioning in this phase.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Bundle | ${result.bundle.bundle_id} |`,
    `| Generated | ${result.generated_at} |`,
    `| Departments | ${result.plan.available_count}/${result.plan.department_count} available |`,
    `| Validation | ${result.bundle.validation_pass ? "PASS" : "FAIL"} |`,
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
    `## Startup order`,
    ``,
    ...result.plan.startup_order.map((id, i) => `${i + 1}. \`${id}\``),
    ``,
    `## Departments`,
    ``,
    ...result.plan.departments.map(
      (d) =>
        `- **${d.label}** (\`${d.id}\`) — ${d.available ? "available" : "missing"} · deps: ${d.depends_on.join(", ") || "none"}`,
    ),
    ``,
    `## Validations`,
    ``,
    ...result.validations.map(
      (v) => `- [${v.pass ? "x" : " "}] ${v.label} — ${v.detail}`,
    ),
    ``,
    `## Artifacts`,
    ``,
    ...result.bundle.artifacts.map((a) => `- \`${a}\``),
    ``,
  ].join("\n");

  writeFileSync(join(DEPLOYMENT_MANAGER_ROOT, "deployment-report.md"), report);
}
