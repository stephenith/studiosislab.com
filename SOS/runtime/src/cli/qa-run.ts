#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { runQaLoop } from "../qa/loop.js";
import { getQaPaths } from "../qa/paths.js";
import { loadQaState, saveQaState } from "../qa/state.js";
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
      console.log(`SOS QA Runtime\n\nUsage:\n  npm run qa:run [-- --once] [-- --poll 5000]\n`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const lock = await acquireRuntimeInstanceLock(config, "qa");
  try {
    installProductionWorkerShutdown("qa", async () => {
      const paths = getQaPaths(config);
      const state = await loadQaState(paths);
      await saveQaState(paths, state);
    });

    const args = parseArgs(process.argv.slice(2));
    console.log("SOS QA runtime starting...", args);
    await runQaLoop({ once: args.once, pollMs: args.pollMs });
    console.log("SOS QA runtime iteration complete.");
  } finally {
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
