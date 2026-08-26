#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { probeTelegramLiveness } from "../commander/telegram-liveness.js";
import { loadPollOffset } from "../approvals/telegram/poll.js";
import { loadPollTelemetry } from "../approvals/telegram/telemetry.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const liveness = await probeTelegramLiveness(config);
  const offset = await loadPollOffset(config);
  const telemetry = await loadPollTelemetry(config);

  const heartbeatPath = join(config.logsRoot, "runtime-heartbeats", "telegram.json");
  let heartbeat: Record<string, unknown> | null = null;
  if (existsSync(heartbeatPath)) {
    try {
      heartbeat = JSON.parse(await readFile(heartbeatPath, "utf8")) as Record<string, unknown>;
    } catch {
      heartbeat = null;
    }
  }

  const report = {
    poller_running: liveness.poller_alive,
    pid: liveness.poller_pid,
    heartbeat_age_ms: liveness.heartbeat_age_ms,
    last_poll: liveness.last_poll,
    last_successful_update: liveness.last_successful_update,
    last_update_id: liveness.last_update_id ?? offset.last_update_id,
    pending_telegram_updates: liveness.pending_update_count,
    offset_file: liveness.offset_file,
    offset_last_update_id: offset.last_update_id,
    offset_updated_at: offset.updated_at,
    last_poll_error: liveness.last_poll_error ?? telemetry.last_poll_error,
    polling_mode: liveness.polling_mode ?? telemetry.polling_mode,
    telegram_conflict: liveness.telegram_conflict,
    poller_process_count: liveness.poller_process_count,
    webhook_enabled: liveness.webhook_enabled,
    commander_alive: liveness.commander_alive,
    supervisor_pid: liveness.supervisor_pid,
    status: liveness.status,
    heartbeat,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!liveness.poller_alive || liveness.telegram_conflict) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
