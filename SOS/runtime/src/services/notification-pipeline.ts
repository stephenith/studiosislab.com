import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "../config.js";
import type { EventEnvelope, EventType, Priority } from "../types.js";
import { appendEventForDispatch } from "../pm/events.js";
import type { PmPaths } from "../pm/paths.js";
import {
  createNotificationTransport,
  isMockNotificationMode,
} from "./notification-transport.js";

export type LifecycleNotificationRequest = {
  event_id?: string;
  correlation_id: string;
  source: string;
  caller: string;
  task_id?: string | null;
  title: string;
  body: string;
  type?: EventType;
  priority?: Priority;
  metadata?: Record<string, unknown>;
};

export type NotificationLedgerEntry = {
  event_id: string;
  correlation_id: string;
  source: string;
  caller: string;
  task_id: string | null;
  title: string;
  timestamp: string;
  delivery_status: "pending" | "sent" | "failed" | "skipped" | "dry_run" | "mock";
  telegram_message_id: number | null;
  error: string | null;
  api_called?: boolean;
};

export type NotificationDeliveryResult = {
  event_id: string;
  correlation_id: string;
  ledger_written: boolean;
  event_appended: boolean;
  dispatcher_queued: boolean;
  telegram_ok: boolean;
  delivery_status: NotificationLedgerEntry["delivery_status"];
  message_id: number | null;
  error: string | null;
  api_called: boolean;
};

function ledgerPath(config: RuntimeConfig): string {
  return join(config.logsRoot, "notifications", "ledger.jsonl");
}

async function appendNotificationLedger(
  config: RuntimeConfig,
  entry: NotificationLedgerEntry,
): Promise<void> {
  const dir = join(config.logsRoot, "notifications");
  await mkdir(dir, { recursive: true });
  await appendFile(ledgerPath(config), `${JSON.stringify(entry)}\n`, "utf8");
}

async function findLedgerDelivery(
  config: RuntimeConfig,
  eventId: string,
): Promise<NotificationLedgerEntry | null> {
  const path = ledgerPath(config);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  let latest: NotificationLedgerEntry | null = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as NotificationLedgerEntry;
      if (row.event_id === eventId) latest = row;
    } catch {
      /* skip malformed */
    }
  }
  return latest;
}

function buildLifecycleEvent(
  request: LifecycleNotificationRequest,
  eventId: string,
): EventEnvelope {
  return {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-pm",
    agent: "pm",
    type: request.type ?? "info",
    priority: request.priority ?? "P2",
    title: request.title,
    body: request.body,
    correlation_id: request.correlation_id,
    requires_approval: false,
    approval_status: "not_required",
    metadata: {
      ...request.metadata,
      source: request.source,
      caller: request.caller,
      task_id: request.task_id ?? null,
      notification_pipeline: true,
    },
  };
}

/**
 * Unified PM / Commander lifecycle notification.
 * Production: one call → one ledger entry → one event → one Telegram send.
 * Mock (SOS_NOTIFICATION_MODE=mock): ledger + trace only — no Telegram API.
 */
export async function sendLifecycleNotification(
  config: RuntimeConfig,
  paths: PmPaths | null,
  request: LifecycleNotificationRequest,
): Promise<NotificationDeliveryResult> {
  const eventId = request.event_id ?? randomUUID();
  const event = buildLifecycleEvent(request, eventId);
  const mockMode = isMockNotificationMode();

  const baseResult: NotificationDeliveryResult = {
    event_id: eventId,
    correlation_id: request.correlation_id,
    ledger_written: false,
    event_appended: false,
    dispatcher_queued: false,
    telegram_ok: false,
    delivery_status: "pending",
    message_id: null,
    error: null,
    api_called: false,
  };

  if (!mockMode && (!config.telegramBotToken || !config.telegramChatId)) {
    await appendNotificationLedger(config, {
      event_id: eventId,
      correlation_id: request.correlation_id,
      source: request.source,
      caller: request.caller,
      task_id: request.task_id ?? null,
      title: request.title,
      timestamp: event.timestamp,
      delivery_status: "skipped",
      telegram_message_id: null,
      error: "telegram_not_configured",
      api_called: false,
    });
    return { ...baseResult, ledger_written: true, delivery_status: "skipped", error: "telegram_not_configured" };
  }

  if (!mockMode && config.dryRun) {
    await appendNotificationLedger(config, {
      event_id: eventId,
      correlation_id: request.correlation_id,
      source: request.source,
      caller: request.caller,
      task_id: request.task_id ?? null,
      title: request.title,
      timestamp: event.timestamp,
      delivery_status: "dry_run",
      telegram_message_id: null,
      error: null,
      api_called: false,
    });
    return { ...baseResult, ledger_written: true, delivery_status: "dry_run", telegram_ok: true };
  }

  if (!mockMode) {
    const priorDelivery = await findLedgerDelivery(config, eventId);
    if (priorDelivery?.delivery_status === "sent" && priorDelivery.telegram_message_id !== null) {
      return {
        ...baseResult,
        ledger_written: false,
        delivery_status: "sent",
        telegram_ok: true,
        message_id: priorDelivery.telegram_message_id,
        error: null,
        api_called: true,
      };
    }
  }

  try {
    if (!mockMode) {
      if (paths) {
        await appendEventForDispatch(config, paths, event);
        baseResult.event_appended = true;
        baseResult.dispatcher_queued = true;
      } else {
        const date = new Date().toISOString().slice(0, 10);
        const eventsFile = join(config.eventsRoot, `${date}.jsonl`);
        await mkdir(config.eventsRoot, { recursive: true });
        await appendFile(eventsFile, `${JSON.stringify(event)}\n`, "utf8");
        baseResult.event_appended = true;
      }
    }

    const transport = createNotificationTransport();
    const delivery = await transport.send(config, event);
    baseResult.telegram_ok = delivery.ok;
    baseResult.message_id = delivery.message_id;
    baseResult.delivery_status = delivery.delivery_status;
    baseResult.error = delivery.error;
    baseResult.api_called = delivery.api_called;

    await appendNotificationLedger(config, {
      event_id: eventId,
      correlation_id: request.correlation_id,
      source: request.source,
      caller: request.caller,
      task_id: request.task_id ?? null,
      title: request.title,
      timestamp: event.timestamp,
      delivery_status: baseResult.delivery_status,
      telegram_message_id: baseResult.message_id,
      error: baseResult.error,
      api_called: baseResult.api_called,
    });
    baseResult.ledger_written = true;

    return baseResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendNotificationLedger(config, {
      event_id: eventId,
      correlation_id: request.correlation_id,
      source: request.source,
      caller: request.caller,
      task_id: request.task_id ?? null,
      title: request.title,
      timestamp: event.timestamp,
      delivery_status: "failed",
      telegram_message_id: null,
      error: msg,
      api_called: false,
    });
    return {
      ...baseResult,
      ledger_written: true,
      delivery_status: "failed",
      error: msg,
    };
  }
}
