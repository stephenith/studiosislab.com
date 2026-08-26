import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { DeveloperPaths } from "./paths.js";
import type { DeveloperRuntimeState } from "./types.js";

export function createInitialDeveloperState(): DeveloperRuntimeState {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    state: "idle",
    started_at: now,
    updated_at: now,
    current_task_id: null,
    current_correlation_id: null,
    claimed_brief_path: null,
    processed_brief_ids: [],
    handed_off_task_ids: [],
    completed_task_ids: [],
    blocked_task_ids: [],
    work_plan_path: null,
    implementation_plan_path: null,
    execution_report_path: null,
    execution_submitted: false,
  };
}

export async function ensureDeveloperDirs(paths: DeveloperPaths): Promise<void> {
  for (const d of [
    paths.root,
    paths.locks,
    paths.plans,
    paths.workPlans,
    paths.implementationPlans,
    paths.reports,
    paths.progress,
    paths.artifacts,
    paths.pmDevReports,
  ]) {
    await mkdir(d, { recursive: true });
  }
}

export async function loadDeveloperState(
  paths: DeveloperPaths,
): Promise<DeveloperRuntimeState> {
  await ensureDeveloperDirs(paths);
  if (!existsSync(paths.state)) {
    const s = createInitialDeveloperState();
    await saveDeveloperState(paths, s);
    return s;
  }
  const state = JSON.parse(await readFile(paths.state, "utf8")) as DeveloperRuntimeState;
  state.processed_brief_ids ??= [];
  state.handed_off_task_ids ??= [];
  state.execution_submitted ??= false;
  state.work_plan_path ??= null;
  state.implementation_plan_path ??= null;
  state.execution_report_path ??= null;
  return state;
}

export async function saveDeveloperState(
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
): Promise<void> {
  state.updated_at = new Date().toISOString();
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf8");
}

export async function resetDeveloperState(
  paths: DeveloperPaths,
): Promise<DeveloperRuntimeState> {
  const s = createInitialDeveloperState();
  await saveDeveloperState(paths, s);
  return s;
}
