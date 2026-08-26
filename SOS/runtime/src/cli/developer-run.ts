#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { runDeveloperLoop } from "../developer/loop.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadDeveloperState, saveDeveloperState } from "../developer/state.js";
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
      console.log(`SOS Developer Runtime

Usage:
  npm run developer:run [-- --once] [-- --dry-run] [-- --poll 5000]
`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const lock = await acquireRuntimeInstanceLock(config, "developer");
  try {
    installProductionWorkerShutdown("developer", async () => {
      const paths = getDeveloperPaths(config);
      const state = await loadDeveloperState(paths);
      await saveDeveloperState(paths, state);
    });

    const args = parseArgs(process.argv.slice(2));
    console.log("SOS Developer runtime starting...", args);
    await runDeveloperLoop({ once: args.once, dryRun: args.dryRun, pollMs: args.pollMs });
    console.log("SOS Developer runtime iteration complete.");
  } finally {
    await lock.release();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
