import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CommanderPaths } from "./paths.js";

export type RestartEvent = {
  timestamp: string;
  worker_id: string;
  reason: string;
  exit_code: number | null;
  restart_count: number;
  crash_count: number;
  expected?: boolean;
};

export type CommanderPersistedState = {
  version: "1.0.0";
  supervisor_started_at: string;
  updated_at: string;
  worker_stats: Record<
    string,
    { crash_count: number; restart_count: number; last_restart_at: string | null }
  >;
};

export async function loadCommanderState(
  paths: CommanderPaths,
): Promise<CommanderPersistedState | null> {
  if (!existsSync(paths.state)) return null;
  try {
    return JSON.parse(await readFile(paths.state, "utf8")) as CommanderPersistedState;
  } catch {
    return null;
  }
}

export async function saveCommanderState(
  paths: CommanderPaths,
  state: CommanderPersistedState,
): Promise<void> {
  state.updated_at = new Date().toISOString();
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf8");
}

export function createCommanderState(startedAt: string): CommanderPersistedState {
  return {
    version: "1.0.0",
    supervisor_started_at: startedAt,
    updated_at: startedAt,
    worker_stats: {},
  };
}

export async function appendRestartEvent(
  paths: CommanderPaths,
  event: RestartEvent,
): Promise<void> {
  await mkdir(paths.root, { recursive: true });
  const line = `${JSON.stringify(event)}\n`;
  await appendFile(join(paths.root, "restart-history.jsonl"), line, "utf8");
}
