/**
 * Single tick helpers — heartbeat + department refresh probes.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./LoopConfiguration.js";
import type { DiscoveredDepartment, LoopConfiguration } from "./types.js";
import type { RuntimeClock } from "./RuntimeClock.js";

export type HeartbeatTick = {
  at: string;
  age_ms_previous: number | null;
  running_count: number;
  detail: string;
};

export function runHeartbeatTick(
  clock: RuntimeClock,
  departments: DiscoveredDepartment[],
  previousHeartbeatAt: string | null,
): HeartbeatTick {
  const at = clock.nowIso();
  const rmHeartbeat = join(
    REPO_ROOT,
    "SOS/07_LOGS/saios/runtime-manager/runtime-heartbeat.json",
  );
  let detail = `loop heartbeat · ${departments.filter((d) => d.available).length} available`;
  if (existsSync(rmHeartbeat)) {
    try {
      const data = JSON.parse(readFileSync(rmHeartbeat, "utf8")) as {
        generated_at?: string;
        running_services?: string[];
      };
      detail += ` · rm_heartbeat=${data.generated_at ?? "n/a"} · running=${data.running_services?.length ?? "?"}`;
    } catch {
      /* ignore */
    }
  }
  return {
    at,
    age_ms_previous: clock.ageMs(previousHeartbeatAt),
    running_count: departments.filter((d) => d.available).length,
    detail,
  };
}

export function refreshDepartmentProbe(
  dept: DiscoveredDepartment | undefined,
  label: string,
  config: LoopConfiguration,
): { ok: boolean; detail: string } {
  if (!dept) {
    return { ok: true, detail: `${label}: not in discovery set — skipped` };
  }
  if (!dept.available) {
    return { ok: false, detail: `${label}: module unavailable (${dept.module_path})` };
  }
  const logDir = join(REPO_ROOT, "SOS/07_LOGS/saios", dept.id);
  const hasLogs = existsSync(logDir);
  return {
    ok: true,
    detail: config.dry_run
      ? `${label}: dry-run refresh · available · logs=${hasLogs}`
      : `${label}: refresh probe · available · logs=${hasLogs}`,
  };
}
