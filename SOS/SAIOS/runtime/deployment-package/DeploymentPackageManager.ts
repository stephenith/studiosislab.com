/**
 * Deployment Package Manager — generate deployable assets only.
 * AGENT #112 — does not deploy; does not modify runtime logic.
 */
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildBackupScript } from "./BackupScriptBuilder.js";
import { buildDockerCompose } from "./DockerComposeBuilder.js";
import { buildDockerfile } from "./DockerfileBuilder.js";
import { writeDeploymentPackageReports } from "./DeploymentPackageReporter.js";
import { verifyDeploymentPackage } from "./DeploymentVerifier.js";
import {
  buildEnvExample,
  validateEnvironment,
} from "./EnvironmentTemplateBuilder.js";
import {
  buildHealthcheckJs,
  buildHealthSpecMd,
  healthSurfaces,
} from "./HealthEndpointBuilder.js";
import { buildInstallScript } from "./InstallScriptBuilder.js";
import { buildRotateLogsScript } from "./LogRotationBuilder.js";
import { ensurePackageRoot, PACKAGE_ROOT } from "./paths.js";
import { buildPm2Config } from "./PM2Builder.js";
import { buildRestoreScript } from "./RestoreScriptBuilder.js";
import { buildSystemdService } from "./SystemdBuilder.js";
import { buildUninstallScript } from "./UninstallScriptBuilder.js";
import { buildUpdateScript } from "./UpdateScriptBuilder.js";
import type { DeploymentPackageResult, GeneratedAsset } from "./types.js";

function writeAsset(
  name: string,
  contents: string,
  kind: string,
  executable = false,
): GeneratedAsset {
  const path = join(PACKAGE_ROOT, name);
  writeFileSync(path, contents);
  if (executable) {
    try {
      chmodSync(path, 0o755);
    } catch {
      /* non-blocking */
    }
  }
  return { name, path, kind };
}

export function runDeploymentPackage(): DeploymentPackageResult {
  const generated_at = new Date().toISOString();
  ensurePackageRoot();

  const assets: GeneratedAsset[] = [
    writeAsset("Dockerfile", buildDockerfile(), "docker"),
    writeAsset("docker-compose.yml", buildDockerCompose(), "docker"),
    writeAsset("pm2.config.cjs", buildPm2Config(), "pm2"),
    writeAsset("aios.service", buildSystemdService(), "systemd"),
    writeAsset(".env.example", buildEnvExample(), "environment"),
    writeAsset("healthcheck.js", buildHealthcheckJs(), "health", true),
    writeAsset("health-endpoint-spec.md", buildHealthSpecMd(), "health"),
    writeAsset("rotate-logs.sh", buildRotateLogsScript(), "script", true),
    writeAsset("backup.sh", buildBackupScript(), "script", true),
    writeAsset("restore.sh", buildRestoreScript(), "script", true),
    writeAsset("update.sh", buildUpdateScript(), "script", true),
    writeAsset("install.sh", buildInstallScript(), "script", true),
    writeAsset("uninstall.sh", buildUninstallScript(), "script", true),
  ];

  const environment = validateEnvironment();
  const health_surfaces = healthSurfaces();

  const partial: DeploymentPackageResult = {
    generated_at,
    status: "READY",
    assets,
    environment,
    health_surfaces,
    checks: {},
    output_dir: PACKAGE_ROOT,
  };

  writeDeploymentPackageReports(partial);
  assets.push({
    name: "deployment-manifest.json",
    path: join(PACKAGE_ROOT, "deployment-manifest.json"),
    kind: "manifest",
  });
  assets.push({
    name: "deployment-package-report.md",
    path: join(PACKAGE_ROOT, "deployment-package-report.md"),
    kind: "report",
  });

  const checks = verifyDeploymentPackage(partial);
  const allPass = Object.values(checks).every(Boolean);

  const result: DeploymentPackageResult = {
    ...partial,
    assets,
    checks,
    status: allPass ? "READY" : "DEGRADED",
  };

  // Refresh report with final checks
  writeDeploymentPackageReports(result);
  return result;
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("DeploymentPackageManager.ts") ||
    process.argv[1].endsWith("DeploymentPackageManager.js"));

if (isMain) {
  const result = runDeploymentPackage();
  console.log(
    JSON.stringify(
      {
        status: result.status,
        assets: result.assets.length,
        missing_env: result.environment.missing,
        output_dir: result.output_dir,
      },
      null,
      2,
    ),
  );
}
