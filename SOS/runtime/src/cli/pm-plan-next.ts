#!/usr/bin/env node
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { planNextTask } from "../pm/planning.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const state = await loadState(paths);

  const result = await planNextTask(config, paths, state, { assign: true, notify: true });
  await saveState(paths, state);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
