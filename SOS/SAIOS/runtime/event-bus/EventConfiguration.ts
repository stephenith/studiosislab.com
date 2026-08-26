/**
 * Event Bus configuration and output paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const EVENT_BUS_ROOT = join(REPO_ROOT, "SOS/07_LOGS/saios/event-bus");

export type EventConfiguration = {
  version: string;
  max_history: number;
  dry_run_automation: boolean;
};

export function defaultEventConfiguration(): EventConfiguration {
  return {
    version: "1.0.0",
    max_history: 500,
    dry_run_automation: true,
  };
}

export function persistEventConfiguration(
  config = defaultEventConfiguration(),
): EventConfiguration {
  mkdirSync(EVENT_BUS_ROOT, { recursive: true });
  writeFileSync(
    join(EVENT_BUS_ROOT, "event-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}
