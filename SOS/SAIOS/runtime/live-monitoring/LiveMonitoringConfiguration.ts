/**
 * Live monitoring configuration — SOS_AIOS_NOTIFY_LIVE gate.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BridgeMode } from "./types.js";

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const LIVE_MONITORING_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/live-monitoring",
);

export const LIVE_FLAG = "SOS_AIOS_NOTIFY_LIVE";

export type LiveMonitoringConfiguration = {
  version: string;
  live_flag: string;
  verify_always_dry_run: true;
  commander_pipeline: string;
  commander_telegram: string;
  commander_email: string;
  commander_transport: string;
};

export function defaultLiveMonitoringConfiguration(): LiveMonitoringConfiguration {
  return {
    version: "1.0.0",
    live_flag: LIVE_FLAG,
    verify_always_dry_run: true,
    commander_pipeline: "SOS/runtime/src/services/notification-pipeline.ts",
    commander_telegram: "SOS/runtime/src/services/telegram.ts",
    commander_email: "SOS/runtime/src/services/email.ts",
    commander_transport: "SOS/runtime/src/services/notification-transport.ts",
  };
}

export function isLiveNotifyEnabled(): boolean {
  const v = process.env[LIVE_FLAG]?.trim();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Resolve bridge mode. Verify callers must pass forceDryRun=true.
 */
export function resolveBridgeMode(forceDryRun = false): BridgeMode {
  if (forceDryRun) return "dry_run";
  return isLiveNotifyEnabled() ? "live" : "dry_run";
}

export function persistLiveMonitoringConfiguration(
  config = defaultLiveMonitoringConfiguration(),
): LiveMonitoringConfiguration {
  mkdirSync(LIVE_MONITORING_ROOT, { recursive: true });
  writeFileSync(
    join(LIVE_MONITORING_ROOT, "live-monitoring-config.json"),
    JSON.stringify(
      {
        ...config,
        live_enabled_now: isLiveNotifyEnabled(),
        note: "Verify always dry-run. Live requires SOS_AIOS_NOTIFY_LIVE=1.",
      },
      null,
      2,
    ),
  );
  return config;
}
