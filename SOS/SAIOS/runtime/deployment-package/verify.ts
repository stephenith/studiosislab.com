/**
 * Deployment Package verify — assets only, no deployment.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runDeploymentPackage } from "./DeploymentPackageManager.js";
import { PACKAGE_ROOT } from "./paths.js";

function main(): void {
  const result = runDeploymentPackage();

  const required = [
    "Dockerfile",
    "docker-compose.yml",
    "pm2.config.cjs",
    "aios.service",
    ".env.example",
    "healthcheck.js",
    "rotate-logs.sh",
    "backup.sh",
    "restore.sh",
    "update.sh",
    "install.sh",
    "uninstall.sh",
    "deployment-manifest.json",
    "deployment-package-report.md",
  ];
  const filesOk = required.every((f) => existsSync(join(PACKAGE_ROOT, f)));

  const checks = {
    docker_assets: result.checks.docker_assets,
    pm2_assets: result.checks.pm2_assets,
    systemd_assets: result.checks.systemd_assets,
    scripts: result.checks.scripts,
    environment_validation: result.checks.environment_validation,
    deployment_manifest: result.checks.deployment_manifest,
    reports: result.checks.reports && filesOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log(
    [
      "Deployment Package Verify",
      "=========================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Status: ${result.status}`,
      `Assets: ${result.assets.length}`,
      `Missing required env: ${result.environment.missing.join(", ") || "none"}`,
      `Deploy performed: no`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );
  process.exit(allPass ? 0 : 1);
}

main();
