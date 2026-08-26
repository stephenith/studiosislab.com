#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import { readCommanderHealth, isCommanderRunning } from "../commander/supervisor.js";
import { loadPipelineStatus } from "../commander/pipeline-status.js";
import { countWorkerProcesses, isSingleInstanceHealthy } from "../commander/process-table.js";
import { monitorWorkerHeartbeats } from "../commander/heartbeat-monitor.js";
import { getRuntimeFreezeInfo } from "../runtime/version.js";
import { probeTelegramLiveness } from "../commander/telegram-liveness.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const { running, pid } = await isCommanderRunning(paths);
  const health = await readCommanderHealth(paths);
  const pipeline = await loadPipelineStatus(config);
  const processCounts = countWorkerProcesses();
  const heartbeatMonitor = await monitorWorkerHeartbeats(config);
  const telegramLiveness = await probeTelegramLiveness(config);

  const effectiveStatus = running ? (health?.status ?? "running") : "dead";

  const instanceHealth =
    !isSingleInstanceHealthy(processCounts) || heartbeatMonitor.frozen_workers.length > 0
      ? "unhealthy"
      : heartbeatMonitor.unhealthy_workers.length > 0
        ? "degraded"
        : "healthy";

  console.log(
    JSON.stringify(
      {
        commander_running: running,
        commander_alive: running,
        supervisor_alive: running,
        status: effectiveStatus,
        supervisor_pid: pid,
        telegram_liveness: telegramLiveness,
        instance_health: instanceHealth,
        pm_processes_found: processCounts.pm_processes_found,
        developer_processes_found: processCounts.developer_processes_found,
        qa_processes_found: processCounts.qa_processes_found,
        telegram_processes_found: processCounts.telegram_processes_found,
        dispatcher_processes_found: processCounts.dispatcher_processes_found,
        heartbeat_monitor: heartbeatMonitor,
        runtime_freeze: getRuntimeFreezeInfo(),
        worker_heartbeats: heartbeatMonitor.workers.map((w) => ({
          worker_id: w.worker_id,
          level: w.level,
          age_ms: w.age_ms,
          jitter_ms: w.jitter_ms,
          busy: w.busy,
          busy_duration_ms: w.busy_duration_ms,
          busy_label: w.busy_label,
          phase: w.phase,
          restart_recommended: w.restart_recommended,
        })),
        health_path: paths.health,
        health,
        pipeline,
        process_table: processCounts,
      },
      null,
      2,
    ),
  );

  if (instanceHealth === "unhealthy" || !running) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
