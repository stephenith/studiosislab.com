#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { createTestEvent, dispatchEvent } from "../dispatcher.js";
import { loadEnvFile } from "../load-env.js";
import { sendLifecycleNotification } from "../services/notification-pipeline.js";
import { sendTestEmail } from "../services/email.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

function parseArgs(argv: string[]): { telegram: boolean; email: boolean; dryRun: boolean } {
  const out = { telegram: true, email: true, dryRun: false };
  for (const arg of argv) {
    if (arg === "--telegram-only") {
      out.email = false;
    } else if (arg === "--email-only") {
      out.telegram = false;
    } else if (arg === "--dry-run") {
      out.dryRun = true;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  if (args.dryRun) config.dryRun = true;

  const event = createTestEvent("P0");
  console.log(`Test event_id: ${event.event_id}`);

  if (args.dryRun) {
    console.log("Dry run — skipping live Telegram/email sends.");
    const dispatch = await dispatchEvent(config, event);
    console.log("Dispatch result:", JSON.stringify(dispatch, null, 2));
    return;
  }

  if (args.telegram) {
    const tg = await sendLifecycleNotification(config, null, {
      event_id: event.event_id,
      correlation_id: event.correlation_id,
      source: "test",
      caller: "test-notify",
      title: "SOS test — Telegram channel OK",
      body: `SOS test — Telegram channel OK\nEvent: ${event.event_id}`,
      type: "info",
      priority: "P0",
    });
    console.log(
      tg.telegram_ok ?
        `Telegram: sent (message_id=${tg.message_id})`
      : `Telegram: FAILED — ${tg.error}`,
    );
  }

  if (args.email) {
    const em = await sendTestEmail(
      config,
      "[SOS TEST] Notification channel check",
      `<p>SOS test — email channel OK</p><p>Event: <code>${event.event_id}</code></p>`,
    );
    console.log(
      em.ok ?
        `Email: sent (message_id=${em.messageId})`
      : `Email: FAILED — ${em.error}`,
    );
  }

  const dispatch = await dispatchEvent(config, event);
  console.log("Dispatch result:", JSON.stringify(dispatch, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
