import type { RuntimeConfig } from "../config.js";
import { sendLifecycleNotification } from "../services/notification-pipeline.js";
import type { WorkerHealth } from "./types.js";
import { CRASH_ALERT_THRESHOLD } from "./workers.js";
import { isUnexpectedCrash } from "./worker-exit.js";

export async function maybeAlertWorkerCrash(
  config: RuntimeConfig,
  worker: WorkerHealth,
): Promise<boolean> {
  if (worker.expected_exit === true || !isUnexpectedCrash(worker)) {
    return false;
  }

  if (worker.crash_count < CRASH_ALERT_THRESHOLD || worker.alerted) {
    return false;
  }

  if (!config.telegramBotToken || !config.telegramChatId || config.dryRun) {
    return false;
  }

  const text = [
    "🚨 SOS Commander Alert",
    "",
    `Worker "${worker.name}" (${worker.id}) crashed ${worker.crash_count} times.`,
    worker.last_error ? `Last error: ${worker.last_error}` : null,
    worker.last_exit_code !== null ? `Exit code: ${worker.last_exit_code}` : null,
    "",
    "Supervisor is attempting automatic restarts.",
  ].filter(Boolean).join("\n");

  const result = await sendLifecycleNotification(config, null, {
    event_id: `commander:crash:${worker.id}:${Date.now()}`,
    correlation_id: `commander-${worker.id}`,
    source: "commander",
    caller: "maybeAlertWorkerCrash",
    task_id: null,
    title: `SOS Commander Alert — ${worker.name}`,
    body: text,
    type: "escalation",
    priority: "P0",
    metadata: {
      worker_id: worker.id,
      crash_count: worker.crash_count,
      last_error: worker.last_error,
    },
  });
  return result.telegram_ok;
}

export async function maybeAlertTelegramRestartFailed(
  config: RuntimeConfig,
  worker: WorkerHealth,
): Promise<boolean> {
  if (worker.id !== "telegram" || worker.alerted) return false;
  if (!config.telegramBotToken || !config.telegramChatId || config.dryRun) return false;

  const text = [
    "🚨 SOS Commander Alert",
    "",
    `Telegram poller failed to recover after ${worker.restart_count} restart(s).`,
    worker.last_error ? `Last error: ${worker.last_error}` : null,
    "",
    "Founder Telegram messages may not be processed until manual intervention.",
  ].filter(Boolean).join("\n");

  const result = await sendLifecycleNotification(config, null, {
    event_id: `commander:telegram-restart-failed:${Date.now()}`,
    correlation_id: "commander-telegram",
    source: "commander",
    caller: "maybeAlertTelegramRestartFailed",
    task_id: null,
    title: "SOS Commander Alert — Telegram Poller Down",
    body: text,
    type: "escalation",
    priority: "P0",
    metadata: {
      worker_id: worker.id,
      restart_count: worker.restart_count,
      last_error: worker.last_error,
    },
  });
  return result.telegram_ok;
}
