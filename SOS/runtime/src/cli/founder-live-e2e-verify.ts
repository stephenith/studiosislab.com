#!/usr/bin/env node
/**
 * Full EXECUTE_NOW pipeline: Inbox → Developer → PM → QA → file on disk.
 * Run with Commander stopped (single-process locks).
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { routeInboxCommand } from "../commander/inbox-ai/command-router.js";
import { runDeveloperLoop } from "../developer/loop.js";
import { runPmLoop } from "../pm/loop.js";
import { runQaLoop } from "../qa/loop.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";
import { clearShutdownFlag } from "../runtime/shutdown.js";

const TEST_FILE = "SOS/07_LOGS/test/agent-032.txt";
const TEST_CONTENT = "ok";

async function main(): Promise<void> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  await clearShutdownFlag(config.logsRoot);
  const testRel = join(config.repoRoot, TEST_FILE);
  const msg = `Create file ${TEST_FILE} containing ${TEST_CONTENT}`;

  const routed = await routeInboxCommand(config, msg);
  if (!routed.result.ok || routed.result.intent !== "EXECUTE_NOW") {
    throw new Error(`EXECUTE_NOW routing failed: ${JSON.stringify(routed.result)}`);
  }

  const taskId = routed.result.details?.task_id as string;

  for (let i = 0; i < 3; i++) {
    await runDeveloperLoop({ once: true });
    const devReport = join(
      config.repoRoot,
      "SOS/07_LOGS/pm/reports/developer",
      `${taskId}.json`,
    );
    if (existsSync(devReport)) break;
  }

  if (!existsSync(testRel)) {
    throw new Error(`Developer did not create ${TEST_FILE}`);
  }
  const content = await readFile(testRel, "utf8");
  if (content !== TEST_CONTENT) {
    throw new Error(`File content mismatch: expected "${TEST_CONTENT}", got "${content}"`);
  }

  for (let i = 0; i < 20; i++) {
    await runPmLoop({ once: true });
    await runQaLoop({ once: true });
    const state = await loadState(pmPaths);
    if (state.completed_task_ids.includes(taskId)) break;
    const task = state.task_queue.find((t) => t.task_id === taskId);
    if (!task) break;
  }

  const finalState = await loadState(pmPaths);
  const completed = finalState.completed_task_ids.includes(taskId);
  const stillInQueue = finalState.task_queue.some((t) => t.task_id === taskId);

  const report = {
    verified_at: new Date().toISOString(),
    task_id: taskId,
    file_exists: existsSync(testRel),
    file_content: content,
    pm_completed: completed,
    removed_from_queue: !stillInQueue,
    pass: existsSync(testRel) && content === TEST_CONTENT && completed,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
