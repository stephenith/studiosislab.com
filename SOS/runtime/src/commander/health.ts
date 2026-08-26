import { writeFile, mkdir } from "node:fs/promises";
import type { RuntimeConfig } from "../config.js";
import type { CommanderPaths } from "./paths.js";
import type { CommanderHealth, WorkerHealth } from "./types.js";
import { loadPipelineStatus } from "./pipeline-status.js";
import { getRuntimeFreezeInfo } from "../runtime/version.js";
import { countWorkerProcesses, isSingleInstanceHealthy } from "./process-table.js";
import { probeTelegramLiveness } from "./telegram-liveness.js";

export async function writeHealth(
  paths: CommanderPaths,
  health: CommanderHealth,
): Promise<void> {
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.health, JSON.stringify(health, null, 2), "utf8");
}

export async function buildHealthSnapshot(
  supervisorPid: number,
  startedAt: string,
  workers: WorkerHealth[],
  status: CommanderHealth["status"] = "running",
  config?: RuntimeConfig,
): Promise<CommanderHealth> {
  const now = Date.now();
  const startedMs = Date.parse(startedAt);
  const snapshot: CommanderHealth = {
    version: "1.0.0",
    supervisor_pid: supervisorPid,
    started_at: startedAt,
    updated_at: new Date().toISOString(),
    uptime_seconds: Math.floor((now - startedMs) / 1000),
    status,
    health_monitor: {
      status: status === "stopped" ? "stopped" : "running",
      interval_seconds: Math.floor(
        parseInt(process.env.SOS_COMMANDER_HEALTH_MS ?? "10000", 10) / 1000,
      ),
      last_write: new Date().toISOString(),
    },
    workers,
  };

  if (config) {
    try {
      snapshot.pipeline = await loadPipelineStatus(config);
    } catch {
      // pipeline status is best-effort
    }

    const processCounts = countWorkerProcesses();
    snapshot.pm_processes_found = processCounts.pm_processes_found;
    snapshot.developer_processes_found = processCounts.developer_processes_found;
    snapshot.qa_processes_found = processCounts.qa_processes_found;
    snapshot.telegram_processes_found = processCounts.telegram_processes_found;
    snapshot.dispatcher_processes_found = processCounts.dispatcher_processes_found;
    snapshot.instance_health = isSingleInstanceHealthy(processCounts) ? "healthy" : "unhealthy";
    snapshot.runtime_freeze = getRuntimeFreezeInfo();

    try {
      const telegramLiveness = await probeTelegramLiveness(config);
      snapshot.commander_alive = status !== "stopped" && status !== "dead";
      snapshot.supervisor_alive = snapshot.commander_alive;
      snapshot.telegram_liveness = {
        commander_alive: telegramLiveness.commander_alive,
        supervisor_alive: telegramLiveness.supervisor_alive,
        telegram_alive: telegramLiveness.telegram_alive,
        poller_alive: telegramLiveness.poller_alive,
        last_poll: telegramLiveness.last_poll,
        last_successful_update: telegramLiveness.last_successful_update,
        last_update_id: telegramLiveness.last_update_id,
        pending_update_count: telegramLiveness.pending_update_count,
        telegram_conflict: telegramLiveness.telegram_conflict,
        poller_pid: telegramLiveness.poller_pid,
        poller_process_count: telegramLiveness.poller_process_count,
        heartbeat_age_ms: telegramLiveness.heartbeat_age_ms,
        last_poll_error: telegramLiveness.last_poll_error,
        polling_mode: telegramLiveness.polling_mode,
        status: telegramLiveness.status,
      };
    } catch {
      // best-effort
    }
  }

  return snapshot;
}
