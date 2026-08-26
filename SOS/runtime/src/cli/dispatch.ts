#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { dispatchEvents } from "../dispatcher.js";
import { loadEnvFile } from "../load-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

function parseArgs(argv: string[]): {
  date?: string;
  file?: string;
  dryRun: boolean;
} {
  const out: { date?: string; file?: string; dryRun: boolean } = {
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--date" && argv[i + 1]) {
      out.date = argv[++i];
    } else if (arg === "--file" && argv[i + 1]) {
      out.file = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return out;
}

function printHelp(): void {
  console.log(`SOS Notification Dispatcher

Usage:
  npm run dispatch [-- --date YYYY-MM-DD] [--file path/to/events.jsonl] [--dry-run]

Reads P0/P1 events from SOS/07_LOGS/events/ and delivers via Telegram and email.
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const results = await dispatchEvents(config, args);

  if (results.length === 0) {
    console.log("No dispatchable events found.");
    return;
  }

  for (const r of results) {
    const summary = r.channels
      .map((c) => `${c.channel}=${c.status}`)
      .join(", ");
    console.log(`${r.event_id} [${r.priority}] ${summary || "no channels"}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
