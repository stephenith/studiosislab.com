import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getCommanderPaths, type CommanderPaths } from "./paths.js";
import {
  countWorkerProcesses,
  isProcessAlive,
  scanWorkerProcesses,
  terminateWorkerProcesses,
} from "./process-table.js";
import {
  fetchTelegramUpdates,
  loadPollOffset,
  savePollOffset,
} from "../approvals/telegram/poll.js";
import { loadPollTelemetry } from "../approvals/telegram/telemetry.js";
import type { WorkerHeartbeatRecord } from "../runtime/worker-heartbeat.js";

export type TelegramLiveness = {
  commander_alive: boolean;
  supervisor_alive: boolean;
  supervisor_pid: number | null;
  telegram_alive: boolean;
  poller_alive: boolean;
  poller_pid: number | null;
  poller_process_count: number;
  heartbeat_age_ms: number | null;
  last_poll: string | null;
  last_successful_update: string | null;
  last_update_id: number | null;
  pending_update_count: number | null;
  telegram_conflict: boolean;
  last_poll_error: string | null;
  polling_mode: string | null;
  offset_file: string;
  offset_updated_at: string | null;
  webhook_enabled: boolean;
  status: "healthy" | "degraded" | "dead" | "conflict" | "stopped";
};

function offsetFilePath(config: RuntimeConfig): string {
  return join(config.logsRoot, "approvals", "telegram-offset.json");
}

async function isSupervisorAlive(
  paths: CommanderPaths,
): Promise<{ running: boolean; pid: number | null }> {
  if (!existsSync(paths.pid)) return { running: false, pid: null };
  const pid = parseInt(await readFile(paths.pid, "utf8"), 10);
  if (Number.isNaN(pid)) return { running: false, pid: null };
  return { running: isProcessAlive(pid), pid };
}

async function readWorkerHeartbeat(
  config: RuntimeConfig,
  workerId: string,
): Promise<WorkerHeartbeatRecord | null> {
  const path = join(config.logsRoot, "runtime-heartbeats", `${workerId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkerHeartbeatRecord;
  } catch {
    return null;
  }
}

async function probeTelegramApi(
  config: RuntimeConfig,
): Promise<{ pending_update_count: number; webhook_enabled: boolean }> {
  if (!config.telegramBotToken) {
    return { pending_update_count: 0, webhook_enabled: false };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/getWebhookInfo`,
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { url?: string; pending_update_count?: number };
    };
    return {
      pending_update_count: payload.result?.pending_update_count ?? 0,
      webhook_enabled: Boolean(payload.result?.url),
    };
  } catch {
    return { pending_update_count: -1, webhook_enabled: false };
  }
}

function readLastInboundConflict(config: RuntimeConfig): boolean {
  const dir = join(config.logsRoot, "approvals", "telegram-inbound");
  if (!existsSync(dir)) return false;
  const today = new Date().toISOString().slice(0, 10);
  const file = join(dir, `${today}.jsonl`);
  if (!existsSync(file)) return false;
  try {
    const buf = readFileSync(file);
    const slice = buf.length > 8000 ? buf.subarray(buf.length - 8000) : buf;
    return slice.toString("utf8").includes("terminated by other getUpdates request");
  } catch {
    return false;
  }
}

export async function probeTelegramLiveness(
  config?: RuntimeConfig,
): Promise<TelegramLiveness> {
  const cfg = config ?? loadConfig();
  const commanderPaths = getCommanderPaths(cfg);
  const { running: commanderAlive, pid: supervisorPid } = await isSupervisorAlive(commanderPaths);

  const processes = scanWorkerProcesses();
  const telegramProcs = processes.filter((p) => p.worker_id === "telegram");
  const counts = countWorkerProcesses();
  const heartbeat = await readWorkerHeartbeat(cfg, "telegram");
  const telemetry = await loadPollTelemetry(cfg);
  const offset = await loadPollOffset(cfg);
  const api = await probeTelegramApi(cfg);

  const staleMs = parseInt(process.env.SOS_TELEGRAM_POLLER_STALE_MS ?? "120000", 10);
  const heartbeatAgeMs = heartbeat?.last_heartbeat
    ? Date.now() - Date.parse(heartbeat.last_heartbeat)
    : null;

  const pollerPid = telegramProcs.find((p) => isProcessAlive(p.pid))?.pid
    ?? (heartbeat?.pid && isProcessAlive(heartbeat.pid) ? heartbeat.pid : null);

  const pollerAlive = Boolean(
    pollerPid
    && isProcessAlive(pollerPid)
    && heartbeatAgeMs !== null
    && heartbeatAgeMs < staleMs,
  );

  const conflict =
    telemetry.telegram_conflict
    || (telemetry.last_poll_error?.includes("terminated by other getUpdates request") ?? false)
    || readLastInboundConflict(cfg)
    || counts.telegram_processes_found > 1;

  let status: TelegramLiveness["status"] = "healthy";
  if (!commanderAlive) status = "dead";
  else if (conflict) status = "conflict";
  else if (!pollerAlive) status = "degraded";
  else if (api.pending_update_count > 0 && !telemetry.last_successful_poll_at) status = "degraded";

  const offsetPath = offsetFilePath(cfg);
  let offsetUpdatedAt: string | null = null;
  if (existsSync(offsetPath)) {
    try {
      const raw = JSON.parse(await readFile(offsetPath, "utf8")) as { updated_at?: string };
      offsetUpdatedAt = raw.updated_at ?? null;
    } catch {
      offsetUpdatedAt = null;
    }
  }

  return {
    commander_alive: commanderAlive,
    supervisor_alive: commanderAlive,
    supervisor_pid: supervisorPid,
    telegram_alive: pollerAlive && !conflict,
    poller_alive: pollerAlive,
    poller_pid: pollerPid,
    poller_process_count: counts.telegram_processes_found,
    heartbeat_age_ms: heartbeatAgeMs,
    last_poll: telemetry.last_poll_at,
    last_successful_update: telemetry.last_successful_poll_at,
    last_update_id: telemetry.last_update_id ?? offset.last_update_id,
    pending_update_count: api.pending_update_count,
    telegram_conflict: conflict,
    last_poll_error: telemetry.last_poll_error,
    polling_mode: telemetry.polling_mode,
    offset_file: offsetPath,
    offset_updated_at: offsetUpdatedAt,
    webhook_enabled: api.webhook_enabled,
    status,
  };
}
