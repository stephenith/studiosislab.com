import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";
import type { Task } from "../pm/types.js";
import { getDeveloperPaths, type DeveloperPaths } from "./paths.js";
import { loadDeveloperState, saveDeveloperState } from "./state.js";
import type { DeveloperRuntimeState } from "./types.js";
import { parseBriefMarkdown } from "./queue.js";
import { prepareTaskFromBrief } from "./prepare.js";

export function clearDeveloperRuntimeFields(state: DeveloperRuntimeState): void {
  state.state = "idle";
  state.current_task_id = null;
  state.current_correlation_id = null;
  state.claimed_brief_path = null;
  state.work_plan_path = null;
  state.implementation_plan_path = null;
  state.execution_report_path = null;
  state.execution_submitted = false;
}

export async function clearDeveloperForNewAssignment(config: RuntimeConfig): Promise<void> {
  const devPaths = getDeveloperPaths(config);
  if (!existsSync(devPaths.state)) return;
  const devState = await loadDeveloperState(devPaths);
  clearDeveloperRuntimeFields(devState);
  await saveDeveloperState(devPaths, devState);
}

async function loadPmDeveloperAssignment(
  config: RuntimeConfig,
): Promise<{ taskId: string; briefPath: string; task: Task } | null> {
  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  const taskId = pmState.developer_assignment?.task_id ?? pmState.current_task_id;
  if (!taskId) return null;

  const task = pmState.task_queue.find((t) => t.task_id === taskId);
  if (!task || task.status !== "developer_working") return null;

  const briefPath =
    pmState.developer_assignment?.brief_path
    ?? task.developer_brief_path
    ?? join(pmPaths.devBriefs, `${taskId}.md`);

  return { taskId, briefPath, task };
}

function developerMatchesPmAssignment(
  state: DeveloperRuntimeState,
  taskId: string,
): boolean {
  return (
    state.current_task_id === taskId
    && (state.state === "working" || state.state === "prepared")
    && Boolean(state.work_plan_path)
    && !state.execution_submitted
  );
}

async function adoptPmBrief(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
  briefPath: string,
  taskId: string,
): Promise<boolean> {
  if (!existsSync(briefPath)) return false;

  if (state.blocked_task_ids.includes(taskId)) {
    state.blocked_task_ids = state.blocked_task_ids.filter((id) => id !== taskId);
  }

  const workPlanPath = join(paths.workPlans, `${taskId}.json`);
  const implPlanPath = join(paths.implementationPlans, `${taskId}.json`);
  const lockPath = join(paths.locks, `${taskId}.json`);
  const execReportPath = join(paths.reports, `${taskId}-execution.json`);

  if (state.processed_brief_ids.includes(taskId) && !existsSync(workPlanPath)) {
    state.processed_brief_ids = state.processed_brief_ids.filter((id) => id !== taskId);
  }

  const content = await readFile(briefPath, "utf8");
  const brief = parseBriefMarkdown(content, briefPath);

  if (existsSync(workPlanPath) && existsSync(lockPath)) {
    state.state = "working";
    state.current_task_id = taskId;
    state.current_correlation_id = brief.correlation_id;
    state.claimed_brief_path = briefPath;
    state.work_plan_path = workPlanPath;
    state.implementation_plan_path = existsSync(implPlanPath) ? implPlanPath : null;
    state.execution_report_path = existsSync(execReportPath) ? execReportPath : null;
    state.execution_submitted = false;
    if (!state.processed_brief_ids.includes(taskId)) {
      state.processed_brief_ids.push(taskId);
    }
    return true;
  }

  await prepareTaskFromBrief(config, paths, state, brief);
  return true;
}

/**
 * Developer loop reconciliation — mirrors PM developer_assignment.
 * Returns true when a new assignment was adopted.
 */
export async function reconcileDeveloperWithPm(
  config: RuntimeConfig,
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
): Promise<boolean> {
  const assignment = await loadPmDeveloperAssignment(config);
  if (!assignment) return false;

  if (developerMatchesPmAssignment(state, assignment.taskId)) {
    if (state.state === "paused") {
      state.state = "working";
      await saveDeveloperState(paths, state);
    }
    return false;
  }

  const needsHandoff =
    state.state === "paused"
    || state.current_task_id !== assignment.taskId
    || !state.work_plan_path
    || state.execution_submitted;

  if (!needsHandoff) return false;

  clearDeveloperRuntimeFields(state);

  const adopted = await adoptPmBrief(
    config,
    paths,
    state,
    assignment.briefPath,
    assignment.taskId,
  );
  if (adopted) {
    await saveDeveloperState(paths, state);
  }
  return adopted;
}

/**
 * Called from assignDeveloper() — propagates PM assignment into developer runtime state.
 */
export async function propagateDeveloperAssignment(
  config: RuntimeConfig,
  task: Task,
  briefPath: string,
): Promise<void> {
  const devPaths = getDeveloperPaths(config);
  const devState = await loadDeveloperState(devPaths);

  if (developerMatchesPmAssignment(devState, task.task_id)) {
    return;
  }

  if (devState.current_task_id !== task.task_id || devState.state === "paused") {
    clearDeveloperRuntimeFields(devState);
  }

  await adoptPmBrief(config, devPaths, devState, briefPath, task.task_id);
  await saveDeveloperState(devPaths, devState);
}

export async function readPmDeveloperAssignmentTaskId(
  config: RuntimeConfig,
): Promise<string | null> {
  const assignment = await loadPmDeveloperAssignment(config);
  return assignment?.taskId ?? null;
}
