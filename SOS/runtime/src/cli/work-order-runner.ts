#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { discoverCursorAgentCli } from "../commander/work-orders/cursor-cli.js";
import { runWorkOrderRunnerLoop } from "../commander/work-orders/runner.js";
import { acquireRuntimeInstanceLock } from "../runtime/single-instance.js";
import { installProductionWorkerShutdown } from "../runtime/worker-shutdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

function parseArgs(argv: string[]): {
  once: boolean;
  dryRun: boolean;
  pollMs?: number;
  force: boolean;
  discoverOnly: boolean;
} {
  const out = {
    once: false,
    dryRun: false,
    pollMs: undefined as number | undefined,
    force: false,
    discoverOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") out.once = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--discover") out.discoverOnly = true;
    else if (a === "--poll" && argv[i + 1]) out.pollMs = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(`SOS Cursor Work Order Runner

Watches SOS/07_LOGS/work-orders/inbox/ and runs cursor agent --print for each queued order.

Usage:
  npm run work-order:run [-- --once] [-- --dry-run] [-- --force] [-- --poll 5000]
  npm run work-order:discover

Auth:
  cursor agent login
  or set CURSOR_API_KEY in SOS/runtime/.env
`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  if (args.discoverOnly) {
    const discovery = await discoverCursorAgentCli();
    console.log(JSON.stringify(discovery, null, 2));
    return;
  }

  const lock = await acquireRuntimeInstanceLock(config, "work-order-runner");
  try {
    installProductionWorkerShutdown("work-order-runner", async () => {});

    console.log("SOS Work Order Runner starting...", {
      once: args.once,
      dryRun: args.dryRun,
      force: args.force,
      pollMs: args.pollMs,
    });

    await runWorkOrderRunnerLoop({
      once: args.once,
      dryRun: args.dryRun,
      pollMs: args.pollMs,
      force: args.force,
    });

    console.log("SOS Work Order Runner stopped.");
  } finally {
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
