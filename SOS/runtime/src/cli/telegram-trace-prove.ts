#!/usr/bin/env node
/**
 * Prove duplicate Telegram send path for one lifecycle notification.
 * Run: npm run pm:telegram-trace-prove
 */
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { sendLifecycleNotification } from "../services/notification-pipeline.js";
import { dispatchEvents } from "../dispatcher.js";
import { readSendTrace } from "../services/telegram-send-trace.js";
import { isMockNotificationMode } from "../services/notification-transport.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const mockMode = isMockNotificationMode();
  const stamp = Date.now();
  const eventId = `trace-prove:pause:${stamp}`;
  const correlationId = `corr-trace-prove-${stamp}`;

  const traceBefore = await readSendTrace(config);
  const beforeCount = traceBefore.length;

  console.log("=== TASK 3: Trigger ONE lifecycle notification ===");
  console.log(`mode=${mockMode ? "mock" : "production"} event_id=${eventId}`);

  const result = await sendLifecycleNotification(config, paths, {
    event_id: eventId,
    correlation_id: correlationId,
    source: "pm",
    caller: "telegram-trace-prove",
    task_id: `TASK-TRACE-${stamp}`,
    title: "Task paused",
    body: `Trace prove pause notification ${stamp}`,
    type: "info",
    priority: "P2",
    metadata: { trace_prove: true, stamp },
  });

  console.log("sendLifecycleNotification:", JSON.stringify(result, null, 2));

  if (!mockMode) {
    const dispatchResults = await dispatchEvents(config);
    const matched = dispatchResults.filter((r) => r.event_id === eventId);
    console.log(`dispatchEvents matched=${matched.length}`, matched);
  } else {
    console.log("dispatchEvents skipped (mock mode — no production event queue)");
  }

  const traceAfter = await readSendTrace(config);
  const newEntries = traceAfter.slice(beforeCount);

  console.log("\n=== SEND TRACE (new entries) ===");
  for (const e of newEntries) {
    console.log(
      [
        `ts=${e.timestamp}`,
        `event_id=${e.event_id}`,
        `hash=${e.message_hash}`,
        `caller=${e.caller_function}`,
        `file=${e.caller_file}`,
        `pid=${e.pid}`,
        `worker=${e.worker}`,
        `api_called=${e.api_called}`,
        `dup_of=${e.duplicate_of ?? "none"}`,
      ].join(" | "),
    );
    console.log(`  stack: ${e.stack.join(" <- ")}`);
  }

  const sameEvent = newEntries.filter((e) => e.event_id === eventId);
  const sameHash = new Set(newEntries.map((e) => e.message_hash));

  console.log("\n=== CLASSIFICATION ===");
  console.log(`sends for event_id: ${sameEvent.length}`);
  console.log(`unique message hashes: ${sameHash.size}`);

  if (sameEvent.length === 2) {
    const [a, b] = sameEvent;
    const pipelineFirst = a.caller_function.includes("sendLifecycleNotification") ||
      a.stack.some((s) => s.includes("notification-pipeline"));
    const dispatcherSecond = b.stack.some((s) => s.includes("dispatcher") || s.includes("deliverChannel"));
    console.log("LIKELY Case A: one event, dual delivery (pipeline immediate + dispatcher)");
    console.log(`  send 1 worker=${a.worker} caller=${a.caller_function}`);
    console.log(`  send 2 worker=${b.worker} caller=${b.caller_function}`);
    if (pipelineFirst && dispatcherSecond) {
      console.log("  CONFIRMED: notification-pipeline sendTelegram + dispatcher deliverChannel");
    }
  } else if (sameEvent.length === 1) {
    console.log("Single send — duplicate eliminated or dispatch skipped (already_delivered)");
  } else {
    console.log(`Unexpected send count: ${sameEvent.length}`);
  }

  process.exit(sameEvent.length === 2 ? 2 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
