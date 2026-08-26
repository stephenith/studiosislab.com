import { rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DeveloperPaths } from "./paths.js";
import type { DeveloperRuntimeState } from "./types.js";
import { loadDeveloperState, saveDeveloperState } from "./state.js";

/** Surgical retry prep for QA failure — does not reset global runtime history. */
export async function prepareDeveloperRetry(
  paths: DeveloperPaths,
  taskId: string,
): Promise<DeveloperRuntimeState> {
  const state = await loadDeveloperState(paths);

  state.processed_brief_ids = state.processed_brief_ids.filter((id) => id !== taskId);
  state.handed_off_task_ids = state.handed_off_task_ids.filter((id) => id !== taskId);

  if (state.current_task_id === taskId) {
    state.current_task_id = null;
    state.current_correlation_id = null;
    state.claimed_brief_path = null;
    state.work_plan_path = null;
    state.implementation_plan_path = null;
    state.execution_report_path = null;
    state.execution_submitted = false;
    state.state = "idle";
  }

  const archiveSuffix = `-qa-retry-${Date.now()}`;

  const devReport = join(paths.pmDevReports, `${taskId}.json`);
  if (existsSync(devReport)) {
    await rename(devReport, join(paths.pmDevReports, `${taskId}${archiveSuffix}.json`));
  }

  for (const dir of [paths.workPlans, paths.implementationPlans, paths.locks]) {
    const file = join(dir, `${taskId}.json`);
    if (existsSync(file)) await unlink(file);
  }

  await saveDeveloperState(paths, state);
  return state;
}
