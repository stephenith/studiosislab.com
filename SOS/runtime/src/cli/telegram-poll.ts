#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { pollTelegramReplies } from "../approvals/telegram/loop.js";
import { acquireRuntimeInstanceLock } from "../runtime/single-instance.js";
import { startWorkerHeartbeat } from "../runtime/worker-heartbeat.js";

function parseArgs(argv: string[]): { once: boolean; longPollSec?: number } {
  const out = { once: false, longPollSec: undefined as number | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") out.once = true;
    else if (a === "--timeout" && argv[i + 1]) out.longPollSec = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(`SOS Telegram inbound poller (getUpdates)

Usage:
  npm run telegram:poll [-- --once] [-- --timeout 25]

Polls Telegram for Commander replies (APPROVE A, REJECT, etc.)
and resumes PM automatically.
`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const lock = await acquireRuntimeInstanceLock(config, "telegram");
  const heartbeat = startWorkerHeartbeat(config, "telegram", { initialPhase: "poll" });
  try {
    console.log("SOS Telegram poll starting...", args);
    heartbeat.setBusy("long_poll");
    const processed = await pollTelegramReplies({
      once: args.once,
      longPollSec: args.longPollSec,
    });
    heartbeat.clearBusy();
    console.log(`SOS Telegram poll complete. Processed ${processed} reply(s).`);
  } finally {
    await heartbeat.stop();
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
