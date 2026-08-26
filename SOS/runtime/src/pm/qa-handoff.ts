import { rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getQaPaths } from "../qa/paths.js";
import { loadQaState, saveQaState } from "../qa/state.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { prepareDeveloperRetry } from "../developer/retry.js";
import { writeBrief } from "./tasks.js";
import type { PmPaths } from "./paths.js";
import type { QaReport, Task } from "./types.js";
import { buildBugFixBrief } from "./tasks.js";

export async function archiveQaReport(paths: PmPaths, taskId: string): Promise<void> {
  const src = join(paths.qaReports, `${taskId}.json`);
  if (existsSync(src)) {
    await rename(src, join(paths.qaReports, `${taskId}-archived-${Date.now()}.json`));
  }
}

export async function archiveQaFullReport(taskId: string): Promise<void> {
  const config = loadConfig();
  const qaPaths = getQaPaths(config);
  const src = join(qaPaths.reports, `${taskId}.json`);
  if (existsSync(src)) {
    await rename(src, join(qaPaths.reports, `${taskId}-archived-${Date.now()}.json`));
  }
  const lock = join(qaPaths.locks, `${taskId}.json`);
  if (existsSync(lock)) await unlink(lock);
}

export async function clearQaRetryState(taskId: string): Promise<void> {
  const config = loadConfig();
  const qaPaths = getQaPaths(config);
  const state = await loadQaState(qaPaths);
  state.failed_task_ids = state.failed_task_ids.filter((id) => id !== taskId);
  state.processed_verification_keys = state.processed_verification_keys.filter(
    (k) => !k.startsWith(`${taskId}:`),
  );
  await saveQaState(qaPaths, state);
}

export async function returnTaskToDeveloperAfterQaFail(
  paths: PmPaths,
  task: Task,
  qaReport: QaReport,
): Promise<string> {
  await archiveQaReport(paths, task.task_id);
  await archiveQaFullReport(task.task_id);
  await clearQaRetryState(task.task_id);

  const devPaths = getDeveloperPaths(loadConfig());
  await prepareDeveloperRetry(devPaths, task.task_id);

  const failedChecks =
    (qaReport as QaReport & { failed_checks?: string[] }).failed_checks
    ?? qaReport.repro_steps
    ?? [];

  const recommended =
    (qaReport as QaReport & { recommended_fixes?: string[] }).recommended_fixes ?? [];

  const brief = buildBugFixBrief(task, qaReport.summary, failedChecks, recommended);
  const briefPath = await writeBrief(paths.devBriefs, task.task_id, brief);

  task.metadata = {
    ...task.metadata,
    qa_verdict: "fail",
    qa_retry: true,
    qa_failed_at: new Date().toISOString(),
  };

  return briefPath;
}
