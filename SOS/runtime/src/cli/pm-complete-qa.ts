#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

async function main(): Promise<void> {
  const taskId = process.argv[2];
  const verdict = (process.argv[3] ?? "pass") as "pass" | "fail" | "blocked";
  if (!taskId) {
    console.error("Usage: npm run pm:complete-qa -- TASK-... [pass|fail|blocked]");
    process.exit(1);
  }

  const config = loadConfig();
  const paths = getPmPaths(config);
  const state = await loadState(paths);

  const task = state.task_queue.find((t) => t.task_id === taskId);
  if (!task) {
    console.error(`Task ${taskId} not found`);
    process.exit(1);
  }

  const report = {
    task_id: taskId,
    correlation_id: task.correlation_id,
    completed_at: new Date().toISOString(),
    verdict,
    summary: `QA ${verdict} (simulated)`,
    evidence: task.evidence,
  };

  const file = join(paths.qaReports, `${taskId}.json`);
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  console.log(`QA report written: ${file}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
