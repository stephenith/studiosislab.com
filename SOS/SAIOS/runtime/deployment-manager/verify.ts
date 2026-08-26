/**
 * Deployment Manager verify — overall PASS when artifacts & checks hold.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runDeploymentManager } from "./DeploymentManager.js";
import { DEPLOYMENT_MANAGER_ROOT } from "./DeploymentConfiguration.js";

const REQUIRED_OUTPUTS = [
  "deployment-plan.json",
  "deployment-bundle.json",
  "startup-order.json",
  "startup.sh",
  "shutdown.sh",
  "restart.sh",
  "deployment-report.md",
  "environment-check.json",
];

function main(): void {
  const result = runDeploymentManager();

  const reportsOk = REQUIRED_OUTPUTS.every((f) =>
    existsSync(join(DEPLOYMENT_MANAGER_ROOT, f)),
  );

  const checks = {
    deployment_planning: result.checks.deployment_planning,
    startup_scripts: result.checks.startup_scripts,
    shutdown_scripts: result.checks.shutdown_scripts,
    restart_scripts: result.checks.restart_scripts,
    bundle_generation: result.checks.bundle_generation,
    environment_validation: result.checks.environment_validation,
    deployment_report: reportsOk && result.checks.deployment_report,
  };

  const allPass = Object.values(checks).every(Boolean);
  const lines = [
    "Deployment Manager Verify",
    "=========================",
    ...Object.entries(checks).map(
      ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
    ),
    "",
    `Status: ${result.status}`,
    `Departments: ${result.plan.available_count}/${result.plan.department_count}`,
    `Bundle: ${result.bundle.bundle_id}`,
    `Startup head: ${result.plan.startup_order[0]}`,
    `Overall: ${allPass ? "PASS" : "FAIL"}`,
  ];
  console.log(lines.join("\n"));
  process.exit(allPass ? 0 : 1);
}

main();
