#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { runPmLoop } from "../pm/loop.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { updateAgentStatus } from "../pm/agents.js";
import { installProductionWorkerShutdown } from "../runtime/worker-shutdown.js";
import { acquireRuntimeInstanceLock } from "../runtime/single-instance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

function parseArgs(argv: string[]): { once: boolean; dryRun: boolean; pollMs?: number } {
  const out = { once: false, dryRun: false, pollMs: undefined as number | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") out.once = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--poll" && argv[i + 1]) out.pollMs = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(`SOS Project Manager Runtime

Usage:
  npm run pm:run [-- --once] [-- --dry-run] [-- --poll 5000]

Continuous coordination loop. Use --once for a single iteration (testing).
`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const lock = await acquireRuntimeInstanceLock(config, "pm");
  try {
    installProductionWorkerShutdown("pm", async () => {
      const paths = getPmPaths(config);
      const state = await loadState(paths);
      state.loop_status = "stopped";
      await saveState(paths, state);
      await updateAgentStatus(paths, state);
    });

    const args = parseArgs(process.argv.slice(2));
    console.log("SOS PM runtime starting...", args);
    await runPmLoop({ once: args.once, dryRun: args.dryRun, pollMs: args.pollMs });
    console.log("SOS PM iteration complete.");
  } finally {
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
