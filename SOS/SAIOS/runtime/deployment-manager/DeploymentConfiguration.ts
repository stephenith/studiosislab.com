/**
 * Deployment Manager configuration and output paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const DEPLOYMENT_MANAGER_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/deployment-manager",
);

export type DeploymentConfiguration = {
  version: string;
  min_node_major: number;
  bundle_prefix: string;
};

export function defaultDeploymentConfiguration(): DeploymentConfiguration {
  return {
    version: "1.0.0",
    min_node_major: 20,
    bundle_prefix: "ai-os-deploy",
  };
}

export function persistDeploymentConfiguration(
  config = defaultDeploymentConfiguration(),
): DeploymentConfiguration {
  mkdirSync(DEPLOYMENT_MANAGER_ROOT, { recursive: true });
  writeFileSync(
    join(DEPLOYMENT_MANAGER_ROOT, "deployment-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}
