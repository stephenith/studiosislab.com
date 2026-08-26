/**
 * Deployment Manager — orchestrates plan, validate, scripts, bundle, report.
 * AGENT #106 — no VPS/Docker; no business-logic changes.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildDeploymentBundle } from "./DeploymentBundleBuilder.js";
import {
  defaultDeploymentConfiguration,
  DEPLOYMENT_MANAGER_ROOT,
  persistDeploymentConfiguration,
} from "./DeploymentConfiguration.js";
import { buildDeploymentPlan } from "./DeploymentPlanner.js";
import { writeDeploymentReports } from "./DeploymentReporter.js";
import { validateDeployment } from "./DeploymentValidator.js";
import { validateEnvironment } from "./EnvironmentValidator.js";
import { generateRestartScript } from "./RestartScriptGenerator.js";
import { generateShutdownScript } from "./ShutdownScriptGenerator.js";
import { generateStartupScript } from "./StartupScriptGenerator.js";
import type { DeploymentManagerResult } from "./types.js";

export function runDeploymentManager(): DeploymentManagerResult {
  const generated_at = new Date().toISOString();
  const config = persistDeploymentConfiguration(
    defaultDeploymentConfiguration(),
  );

  const plan = buildDeploymentPlan(config.version, generated_at);
  const environment = validateEnvironment(config, generated_at);
  const validations = validateDeployment({ plan, environment });

  const startup = generateStartupScript(plan);
  const shutdown = generateShutdownScript(plan);
  const restart = generateRestartScript();

  const bundle = buildDeploymentBundle({
    plan,
    generatedAt: generated_at,
    version: config.version,
    bundlePrefix: config.bundle_prefix,
    validations,
    scriptNames: {
      startup: "startup.sh",
      shutdown: "shutdown.sh",
      restart: "restart.sh",
    },
  });

  const checks = {
    deployment_planning:
      plan.startup_order.length === plan.departments.length &&
      plan.available_count === plan.departments.length,
    startup_scripts: startup.includes("npm run") && startup.includes("#!/usr/bin/env bash"),
    shutdown_scripts: shutdown.includes("STOP") && shutdown.includes("#!/usr/bin/env bash"),
    restart_scripts:
      restart.includes("shutdown.sh") && restart.includes("startup.sh"),
    bundle_generation: Boolean(bundle.bundle_id) && bundle.artifacts.length > 0,
    environment_validation: environment.pass,
    deployment_report: true,
  };

  const allCorePass = validations.every((v) => v.pass);
  let status: DeploymentManagerResult["status"] = "READY";
  if (!allCorePass || !environment.pass) status = "DEGRADED";
  if (plan.available_count < 8) status = "BLOCKED";

  const result: DeploymentManagerResult = {
    generated_at,
    status,
    plan,
    bundle: { ...bundle, status },
    environment,
    validations,
    checks,
    output_dir: DEPLOYMENT_MANAGER_ROOT,
  };

  writeDeploymentReports(result, { startup, shutdown, restart });

  // Confirm scripts landed for verify
  result.checks.startup_scripts =
    result.checks.startup_scripts &&
    existsSync(join(DEPLOYMENT_MANAGER_ROOT, "startup.sh"));
  result.checks.shutdown_scripts =
    result.checks.shutdown_scripts &&
    existsSync(join(DEPLOYMENT_MANAGER_ROOT, "shutdown.sh"));
  result.checks.restart_scripts =
    result.checks.restart_scripts &&
    existsSync(join(DEPLOYMENT_MANAGER_ROOT, "restart.sh"));
  result.checks.deployment_report = existsSync(
    join(DEPLOYMENT_MANAGER_ROOT, "deployment-report.md"),
  );

  return result;
}

/** CLI entry */
const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("DeploymentManager.ts") ||
    process.argv[1].endsWith("DeploymentManager.js"));

if (isMain) {
  const result = runDeploymentManager();
  console.log(
    JSON.stringify(
      {
        status: result.status,
        departments: result.plan.department_count,
        available: result.plan.available_count,
        bundle_id: result.bundle.bundle_id,
        startup_order: result.plan.startup_order,
        output_dir: result.output_dir,
      },
      null,
      2,
    ),
  );
}
