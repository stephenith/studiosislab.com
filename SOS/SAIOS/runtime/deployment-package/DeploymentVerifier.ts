/**
 * Verify generated deployment assets exist (no deploy).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_ROOT } from "./paths.js";
import type { DeploymentPackageResult } from "./types.js";

const DOCKER = ["Dockerfile", "docker-compose.yml"];
const PM2 = ["pm2.config.cjs"];
const SYSTEMD = ["aios.service"];
const SCRIPTS = [
  "rotate-logs.sh",
  "backup.sh",
  "restore.sh",
  "update.sh",
  "install.sh",
  "uninstall.sh",
  "healthcheck.js",
];

export function verifyDeploymentPackage(
  result: DeploymentPackageResult,
): Record<string, boolean> {
  const has = (name: string) => existsSync(join(PACKAGE_ROOT, name));

  return {
    docker_assets: DOCKER.every(has),
    pm2_assets: PM2.every(has),
    systemd_assets: SYSTEMD.every(has),
    scripts: SCRIPTS.every(has) && has(".env.example"),
    environment_validation:
      result.environment.required.length > 0 &&
      result.environment.rules.length > 0,
    deployment_manifest: has("deployment-manifest.json"),
    reports: has("deployment-package-report.md"),
  };
}
