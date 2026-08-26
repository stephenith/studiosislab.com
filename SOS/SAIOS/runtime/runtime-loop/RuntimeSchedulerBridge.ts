/**
 * Scheduler bridge — tick only; does not run production jobs.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./LoopConfiguration.js";
import type { LoopConfiguration } from "./types.js";

export type SchedulerTickResult = {
  at: string;
  ok: boolean;
  detail: string;
  dry_run: boolean;
};

export function runSchedulerBridgeTick(
  config: LoopConfiguration,
): SchedulerTickResult {
  const at = new Date().toISOString();
  const healthPath = join(
    REPO_ROOT,
    "SOS/07_LOGS/saios/scheduler/scheduler-health.json",
  );
  const modulePath = join(REPO_ROOT, "SOS/SAIOS/runtime/scheduler");

  if (!existsSync(modulePath)) {
    return {
      at,
      ok: false,
      detail: "scheduler module missing",
      dry_run: config.dry_run,
    };
  }

  let status = "module-available";
  if (existsSync(healthPath)) {
    try {
      const data = JSON.parse(readFileSync(healthPath, "utf8")) as {
        status?: string;
        health?: string;
      };
      status = String(data.status ?? data.health ?? "ok");
    } catch {
      status = "health-unreadable";
    }
  }

  return {
    at,
    ok: true,
    detail: config.dry_run
      ? `dry-run scheduler tick · observed=${status} · interval=${config.scheduler_interval_ms}ms`
      : `scheduler tick · observed=${status}`,
    dry_run: config.dry_run,
  };
}
