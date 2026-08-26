#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { getCommanderPaths } from "../commander/paths.js";
import { isCommanderRunning, stopCommanderByPid } from "../commander/supervisor.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getCommanderPaths(config);
  const { running, pid } = await isCommanderRunning(paths);

  if (!running) {
    console.log("Commander supervisor is not running.");
    process.exit(0);
  }

  const stopped = await stopCommanderByPid(paths);
  if (stopped) {
    console.log(`Sent SIGTERM to commander supervisor (pid ${pid}).`);
  } else {
    console.log("Failed to stop commander supervisor.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
