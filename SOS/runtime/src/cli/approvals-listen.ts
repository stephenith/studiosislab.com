#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { runApprovalsListenLoop } from "../approvals/loop.js";
import { getApprovalsPaths } from "../approvals/paths.js";
import { loadApprovalsState, saveApprovalsState } from "../approvals/state.js";
import { installProductionWorkerShutdown } from "../runtime/worker-shutdown.js";
import { acquireRuntimeInstanceLock } from "../runtime/single-instance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

function parseArgs(argv: string[]): { once: boolean; pollMs?: number } {
  const out = { once: false, pollMs: undefined as number | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") out.once = true;
    else if (a === "--poll" && argv[i + 1]) out.pollMs = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(`SOS Commander Approval Listener

Watches SOS/07_LOGS/approvals/inbox/ for CCP decision files
and polls Telegram getUpdates for Commander replies.

Usage:
  npm run approvals:listen [-- --once] [-- --poll 3000]

Drop a JSON file:
  { "approval_id": "APP-YYYYMMDD-001", "command": "APPROVE A" }

Or a text file APP-YYYYMMDD-001.txt containing:
  APPROVE A
`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const lock = await acquireRuntimeInstanceLock(config, "approvals");
  try {
    installProductionWorkerShutdown("approvals", async () => {
      const paths = getApprovalsPaths(config);
      const state = await loadApprovalsState(paths);
      await saveApprovalsState(paths, state);
    });

    const args = parseArgs(process.argv.slice(2));
    console.log("SOS approvals listener starting...", args);
    await runApprovalsListenLoop({ once: args.once, pollMs: args.pollMs });
    console.log("SOS approvals listener iteration complete.");
  } finally {
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
