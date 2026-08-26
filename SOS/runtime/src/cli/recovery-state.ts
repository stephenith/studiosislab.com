import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export async function readDeveloperState(config: RuntimeConfig): Promise<{
  state: string;
  current_task_id: string | null;
  execution_submitted: boolean;
}> {
  const path = join(config.sosRoot, "07_LOGS", "developer", "state.json");
  if (!existsSync(path)) {
    return { state: "missing", current_task_id: null, execution_submitted: false };
  }
  const raw = JSON.parse(await readFile(path, "utf8")) as {
    state: string;
    current_task_id: string | null;
    execution_submitted: boolean;
  };
  return {
    state: raw.state,
    current_task_id: raw.current_task_id,
    execution_submitted: raw.execution_submitted,
  };
}

export async function readQaState(config: RuntimeConfig): Promise<{
  state: string;
  current_task_id: string | null;
}> {
  const path = join(config.sosRoot, "07_LOGS", "qa", "state.json");
  if (!existsSync(path)) {
    return { state: "missing", current_task_id: null };
  }
  const raw = JSON.parse(await readFile(path, "utf8")) as {
    state: string;
    current_task_id: string | null;
  };
  return { state: raw.state, current_task_id: raw.current_task_id };
}
