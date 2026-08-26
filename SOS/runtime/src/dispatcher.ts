import { readFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "./config.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { DeliveryLog } from "./delivery-log.js";
import { DeadLetterQueue } from "./dead-letter.js";
import { RetryQueue } from "./retry.js";
import { shouldDeferForQuietHours } from "./quiet-hours.js";
import { QuietHoursQueue } from "./quiet-hours-queue.js";
import { sendTelegram } from "./services/telegram.js";
import { sendEmail } from "./services/email.js";
import { parseEventLine, EventValidationError } from "./validate-event.js";
import { approvalIdFromEvent, logDispatch } from "./dispatch-logger.js";
import type {
  DeliveryChannel,
  DispatchResult,
  EventEnvelope,
  Priority,
} from "./types.js";

export type DispatchOptions = {
  date?: string;
  file?: string;
  dryRun?: boolean;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function channelsForEvent(
  config: RuntimeConfig,
  event: EventEnvelope,
): DeliveryChannel[] {
  const routing = config.channels[event.priority];
  const out: DeliveryChannel[] = [];

  // CCP approval packets always notify via Telegram + email (CDE/CCP requirement)
  if (event.type === "approval_request" || event.requires_approval) {
    out.push("telegram");
    out.push("email");
    return out;
  }

  if (routing.telegram) out.push("telegram");
  if (routing.email === true) out.push("email");
  return out;
}

async function readEvents(
  config: RuntimeConfig,
  options: DispatchOptions,
): Promise<EventEnvelope[]> {
  const filePath =
    options.file ??
    join(config.eventsRoot, `${options.date ?? todayIsoDate()}.jsonl`);

  if (!existsSync(filePath)) {
    return [];
  }

  const raw = await readFile(filePath, "utf8");
  const events: EventEnvelope[] = [];
  const lines = raw.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      events.push(parseEventLine(line, i + 1));
    } catch (e) {
      if (e instanceof EventValidationError) {
        await appendMalformed(config, line, e.message);
        continue;
      }
      throw e;
    }
  }

  return events;
}

async function appendMalformed(
  config: RuntimeConfig,
  line: string,
  error: string,
): Promise<void> {
  const path = join(config.dispatchRoot, "malformed.jsonl");
  await mkdir(config.dispatchRoot, { recursive: true });
  await appendFile(
    path,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      error,
      line: line.slice(0, 500),
    })}\n`,
    "utf8",
  );
}

async function deliverChannel(
  config: RuntimeConfig,
  event: EventEnvelope,
  channel: DeliveryChannel,
  attempt: number,
  deliveryLog: DeliveryLog,
  retryQueue: RetryQueue,
  deadLetter: DeadLetterQueue,
  breaker: CircuitBreaker,
): Promise<{ status: "sent" | "failed" | "skipped" | "queued" | "dry_run"; error?: string }> {
  const approvalId = approvalIdFromEvent(event);

  const recordBase = {
    event_id: event.event_id,
    channel,
    attempt,
    priority: event.priority,
    approval_id: approvalId,
  };

  if (!breaker.allowsPriority(event.priority)) {
    const error = "Circuit breaker open — only P0 allowed";
    await deliveryLog.append({ ...recordBase, status: "skipped", error });
    return { status: "skipped", error };
  }

  if (await deliveryLog.wasDelivered(event.event_id, channel)) {
    await deliveryLog.append({ ...recordBase, status: "skipped", error: "already_delivered" });
    return { status: "skipped" };
  }

  if (shouldDeferForQuietHours(event.priority, config)) {
    const qh = new QuietHoursQueue(config);
    await qh.enqueue(event, `quiet_hours:${channel}`);
    await deliveryLog.append({ ...recordBase, status: "queued" });
    return { status: "queued" };
  }

  if (config.dryRun) {
    await deliveryLog.append({ ...recordBase, status: "dry_run" });
    return { status: "dry_run" };
  }

  let result: { ok: boolean; error?: string; messageId?: number | string | null };
  try {
    result =
      channel === "telegram" ?
        await sendTelegram(config, event)
      : await sendEmail(config, event);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await breaker.recordFailure();
    if (channel === "telegram") {
      await logDispatch(config, {
        message: "telegram_dispatch_failed",
        event_id: event.event_id,
        approval_id: approvalId,
        channel: "telegram",
        error,
      });
    }
    await deliveryLog.append({ ...recordBase, status: "failed", error });
    await logDispatch(config, {
      message: "delivery_result",
      event_id: event.event_id,
      approval_id: approvalId,
      channel,
      status: "failed",
      error,
    });
    return { status: "failed", error };
  }

  if (result.ok) {
    await breaker.recordSuccess();
    await deliveryLog.append({
      ...recordBase,
      status: "sent",
      external_id:
        channel === "telegram" ?
          String((result as { messageId: number }).messageId)
        : String((result as { messageId: string | null }).messageId ?? ""),
    });
    await logDispatch(config, {
      message: "delivery_result",
      event_id: event.event_id,
      approval_id: approvalId,
      channel,
      status: "sent",
      delivery_result: result,
    });
    return { status: "sent" };
  }

  const error = result.error ?? "Unknown delivery error";
  await breaker.recordFailure();

  if (channel === "telegram") {
    await logDispatch(config, {
      message: "telegram_dispatch_failed",
      event_id: event.event_id,
      approval_id: approvalId,
      channel: "telegram",
      error,
      delivery_result: result,
    });
  }

  if (attempt >= config.retry.max_attempts) {
    await deadLetter.enqueue(event, channel, attempt, error);
    await deliveryLog.append({ ...recordBase, status: "failed", error });
    await logDispatch(config, {
      message: "delivery_result",
      event_id: event.event_id,
      approval_id: approvalId,
      channel,
      status: "failed",
      error,
      delivery_result: result,
    });
    return { status: "failed", error };
  }

  await retryQueue.enqueue(event, channel, attempt + 1, error, config);
  await deliveryLog.append({ ...recordBase, status: "failed", error });
  await logDispatch(config, {
    message: "delivery_result",
    event_id: event.event_id,
    approval_id: approvalId,
    channel,
    status: "failed",
    error,
    delivery_result: result,
  });
  return { status: "failed", error };
}

function shouldDispatch(event: EventEnvelope): boolean {
  if (event.priority === "P3") return false;
  if (event.priority === "P2") return false; // digest-only in Phase 2; no instant dispatch
  return true;
}

export async function dispatchEvent(
  config: RuntimeConfig,
  event: EventEnvelope,
  deps?: {
    deliveryLog?: DeliveryLog;
    retryQueue?: RetryQueue;
    deadLetter?: DeadLetterQueue;
    breaker?: CircuitBreaker;
  },
): Promise<DispatchResult> {
  const deliveryLog = deps?.deliveryLog ?? new DeliveryLog(config);
  const retryQueue = deps?.retryQueue ?? new RetryQueue(config);
  const deadLetter = deps?.deadLetter ?? new DeadLetterQueue(config);
  const breaker = deps?.breaker ?? new CircuitBreaker(config);
  await breaker.load();
  await deliveryLog.ensureDirs();

  const result: DispatchResult = {
    event_id: event.event_id,
    priority: event.priority,
    channels: [],
  };

  if (!shouldDispatch(event)) {
    return result;
  }

  const channels = channelsForEvent(config, event);

  for (const channel of channels) {
    const channelResult = await deliverChannel(
      config,
      event,
      channel,
      1,
      deliveryLog,
      retryQueue,
      deadLetter,
      breaker,
    );
    result.channels.push({
      channel,
      status: channelResult.status,
      error: channelResult.error,
    });
  }

  await logDispatch(config, {
    message: "delivery_result",
    event_id: event.event_id,
    approval_id: approvalIdFromEvent(event),
    delivery_result: result,
  });

  return result;
}

export async function dispatchEvents(
  config: RuntimeConfig,
  options: DispatchOptions = {},
): Promise<DispatchResult[]> {
  const effectiveConfig = { ...config, dryRun: options.dryRun ?? config.dryRun };
  const events = await readEvents(effectiveConfig, options);
  const deliveryLog = new DeliveryLog(effectiveConfig);
  const retryQueue = new RetryQueue(effectiveConfig);
  const deadLetter = new DeadLetterQueue(effectiveConfig);
  const breaker = new CircuitBreaker(effectiveConfig);
  await breaker.load();

  const results: DispatchResult[] = [];
  for (const event of events) {
    results.push(
      await dispatchEvent(effectiveConfig, event, {
        deliveryLog,
        retryQueue,
        deadLetter,
        breaker,
      }),
    );
  }
  return results;
}

export async function processRetryQueue(
  config: RuntimeConfig,
): Promise<DispatchResult[]> {
  const retryQueue = new RetryQueue(config);
  const deliveryLog = new DeliveryLog(config);
  const deadLetter = new DeadLetterQueue(config);
  const breaker = new CircuitBreaker(config);
  await breaker.load();

  const due = await retryQueue.loadDue();
  const results: DispatchResult[] = [];

  for (const entry of due) {
    const channelResult = await deliverChannel(
      config,
      entry.event,
      entry.channel,
      entry.attempt,
      deliveryLog,
      retryQueue,
      deadLetter,
      breaker,
    );
    results.push({
      event_id: entry.event.event_id,
      priority: entry.event.priority,
      channels: [
        {
          channel: entry.channel,
          status: channelResult.status,
          error: channelResult.error,
        },
      ],
    });
  }

  return results;
}

export function createTestEvent(priority: Priority = "P0"): EventEnvelope {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-notify",
    agent: "dispatcher",
    type: "info",
    priority,
    title: "SOS notification test",
    body: "If you received this, Phase 2 dispatch is working.",
    correlation_id: randomUUID(),
    requires_approval: false,
    approval_status: "not_required",
    metadata: { source: "test-notify-cli" },
  };
}
