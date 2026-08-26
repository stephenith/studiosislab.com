import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { QaPaths } from "./paths.js";
import type { QaRuntimeState } from "./types.js";

export function createInitialQaState(): QaRuntimeState {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    state: "idle",
    started_at: now,
    updated_at: now,
    current_task_id: null,
    current_correlation_id: null,
    claimed_brief_path: null,
    completed_task_ids: [],
    failed_task_ids: [],
    processed_verification_keys: [],
  };
}

export async function ensureQaDirs(paths: QaPaths): Promise<void> {
  for (const d of [
    paths.root,
    paths.locks,
    paths.reports,
    paths.progress,
    paths.checklists,
    paths.pmQaReports,
  ]) {
    await mkdir(d, { recursive: true });
  }
}

export async function loadQaState(paths: QaPaths): Promise<QaRuntimeState> {
  await ensureQaDirs(paths);
  if (!existsSync(paths.state)) {
    const s = createInitialQaState();
    await saveQaState(paths, s);
    return s;
  }
  const state = JSON.parse(await readFile(paths.state, "utf8")) as QaRuntimeState;
  state.processed_verification_keys ??= [];
  return state;
}

export async function saveQaState(paths: QaPaths, state: QaRuntimeState): Promise<void> {
  state.updated_at = new Date().toISOString();
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf8");
}

export async function resetQaState(paths: QaPaths): Promise<QaRuntimeState> {
  const s = createInitialQaState();
  await saveQaState(paths, s);
  return s;
}
