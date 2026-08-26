#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { processRetryQueue } from "../dispatcher.js";
import { loadEnvFile } from "../load-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

async function main(): Promise<void> {
  const config = loadConfig();
  const results = await processRetryQueue(config);

  if (results.length === 0) {
    console.log("No retry entries due.");
    return;
  }

  for (const r of results) {
    const summary = r.channels
      .map((c) => `${c.channel}=${c.status}`)
      .join(", ");
    console.log(`${r.event_id} retry: ${summary}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
