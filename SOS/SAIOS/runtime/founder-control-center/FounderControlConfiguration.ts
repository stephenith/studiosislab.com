/**
 * Founder Control Center configuration and paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const FCC_ROOT = join(REPO_ROOT, "SOS/07_LOGS/saios/founder-control-center");
export const LOGS = join(REPO_ROOT, "SOS/07_LOGS/saios");

export type FounderControlConfiguration = {
  version: string;
  role: string;
};

export function defaultFounderControlConfiguration(): FounderControlConfiguration {
  return {
    version: "1.0.0",
    role: "founder-operational-headquarters",
  };
}

export function persistFounderControlConfiguration(
  config = defaultFounderControlConfiguration(),
): FounderControlConfiguration {
  mkdirSync(FCC_ROOT, { recursive: true });
  writeFileSync(
    join(FCC_ROOT, "founder-control-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}
