#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

async function main(): Promise<void> {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: npm run pm:complete-dev -- TASK-...");
    process.exit(1);
  }

  const config = loadConfig();
  const paths = getPmPaths(config);
  const state = await loadState(paths);

  const task = state.task_queue.find((t) => t.task_id === taskId);
  if (!task) {
    console.error(`Task ${taskId} not found in queue`);
    process.exit(1);
  }

  const report = {
    task_id: taskId,
    correlation_id: task.correlation_id,
    completed_at: new Date().toISOString(),
    summary: process.argv[3] ?? "Developer work completed (simulated)",
    files_changed: task.evidence.filter((e) => e.startsWith("src/")),
    build_passed: true,
    confidence: parseInt(process.argv[4] ?? "85", 10),
    blocker: process.argv.includes("--blocker"),
    blocker_reason: process.argv.includes("--blocker") ? "Simulated blocker" : undefined,
    evidence: task.evidence,
  };

  const file = join(paths.devReports, `${taskId}.json`);
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  console.log(`Developer report written: ${file}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
