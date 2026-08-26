import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { PmPaths } from "./paths.js";
import type { PmState } from "./types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createInitialState(): PmState {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    started_at: now,
    updated_at: now,
    loop_status: "idle",
    current_task_id: null,
    developer_assignment: null,
    qa_assignment: null,
    waiting_approvals: [],
    completed_task_ids: [],
    blocked_task_ids: [],
    task_queue: [],
    interruption_budget: {
      date: today(),
      approvals_sent: 0,
      blockers_sent: 0,
      p0_sent: 0,
      total_sent: 0,
    },
    notified_backlog_ids: [],
    last_selection: null,
    paused_tasks: [],
    reprioritization: null,
    notified_pause_ids: [],
    reprioritization_notifications: [],
  };
}

export async function ensurePmDirs(paths: PmPaths): Promise<void> {
  const dirs = [
    paths.root,
    paths.queues,
    paths.devBriefs,
    paths.devBriefsArchived,
    paths.qaBriefs,
    paths.devReports,
    paths.qaReports,
    paths.approvals,
    paths.approvalResponses,
    paths.decisions,
  ];
  for (const d of dirs) {
    await mkdir(d, { recursive: true });
  }
}

export async function loadState(paths: PmPaths): Promise<PmState> {
  await ensurePmDirs(paths);
  if (!existsSync(paths.state)) {
    const state = createInitialState();
    await saveState(paths, state);
    return state;
  }
  const raw = await readFile(paths.state, "utf8");
  const state = JSON.parse(raw) as PmState;
  state.notified_backlog_ids ??= [];
  state.last_selection ??= null;
  state.roadmap ??= {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    epics: [],
    slices: [],
    known_slice_ids: [],
  };
  state.roadmap.known_slice_ids ??= [];
  state.roadmap.epics ??= [];
  state.roadmap.slices ??= [];
  state.paused_tasks ??= [];
  state.reprioritization ??= null;
  state.notified_pause_ids ??= [];
  state.reprioritization_notifications ??= [];
  backfillReprioritizationNotifications(state);
  if (state.interruption_budget.date !== today()) {
    state.interruption_budget = {
      date: today(),
      approvals_sent: 0,
      blockers_sent: 0,
      p0_sent: 0,
      total_sent: 0,
    };
  }
  return state;
}

function backfillReprioritizationNotifications(state: PmState): void {
  for (const paused of state.paused_tasks ?? []) {
    if (!paused.replacement_task_id || !paused.replacement_backlog_id) continue;
    if (!state.notified_pause_ids?.includes(paused.task_id)) continue;

    const eventId =
      paused.reprioritization_event_id
      ?? `reprio:${paused.task_id}:${paused.backlog_id}:${paused.replacement_task_id}:${paused.replacement_backlog_id}`;

    const exists = state.reprioritization_notifications!.some(
      (n) => n.event_id === eventId || n.paused_task_id === paused.task_id,
    );
    if (exists) continue;

    state.reprioritization_notifications!.push({
      event_id: eventId,
      paused_task_id: paused.task_id,
      paused_backlog_id: paused.backlog_id,
      replacement_task_id: paused.replacement_task_id,
      replacement_backlog_id: paused.replacement_backlog_id,
      notified_at: paused.paused_at,
      telegram_sent: true,
    });
  }
}

export async function saveState(paths: PmPaths, state: PmState): Promise<void> {
  state.updated_at = new Date().toISOString();
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf8");
}

export async function appendJsonl(path: string, record: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}
