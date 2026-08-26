import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ApprovalsPaths } from "./paths.js";
import type { ApprovalRecord, ApprovalsRuntimeState } from "./types.js";

export function createInitialApprovalsState(): ApprovalsRuntimeState {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    started_at: now,
    updated_at: now,
    processed_inbox_files: [],
    processed_telegram_update_ids: [],
    estop_active: false,
    last_processed_at: null,
  };
}

export async function ensureApprovalsDirs(paths: ApprovalsPaths): Promise<void> {
  for (const d of [
    paths.root,
    paths.inbox,
    paths.processed,
    paths.invalid,
    paths.records,
    paths.pmResponses,
    paths.decisions,
  ]) {
    await mkdir(d, { recursive: true });
  }
}

export async function loadApprovalsState(paths: ApprovalsPaths): Promise<ApprovalsRuntimeState> {
  await ensureApprovalsDirs(paths);
  if (!existsSync(paths.state)) {
    const s = createInitialApprovalsState();
    await saveApprovalsState(paths, s);
    return s;
  }
  const raw = await readFile(paths.state, "utf8");
  if (!raw.trim()) {
    const s = createInitialApprovalsState();
    await saveApprovalsState(paths, s);
    return s;
  }
  try {
    return normalizeApprovalsState(JSON.parse(raw) as ApprovalsRuntimeState);
  } catch {
    const s = createInitialApprovalsState();
    await saveApprovalsState(paths, s);
    return s;
  }
}

function normalizeApprovalsState(state: ApprovalsRuntimeState): ApprovalsRuntimeState {
  if (!Array.isArray(state.processed_inbox_files)) state.processed_inbox_files = [];
  if (!Array.isArray(state.processed_telegram_update_ids)) {
    state.processed_telegram_update_ids = [];
  }
  return state;
}

export async function saveApprovalsState(
  paths: ApprovalsPaths,
  state: ApprovalsRuntimeState,
): Promise<void> {
  state.updated_at = new Date().toISOString();
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf8");
}

export async function loadApprovalRecord(
  paths: ApprovalsPaths,
  approvalId: string,
): Promise<ApprovalRecord | null> {
  const file = `${paths.records}/${approvalId}.json`;
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as ApprovalRecord;
}

export async function saveApprovalRecord(
  paths: ApprovalsPaths,
  record: ApprovalRecord,
): Promise<void> {
  record.updated_at = new Date().toISOString();
  await writeFile(
    `${paths.records}/${record.approval_id}.json`,
    JSON.stringify(record, null, 2),
    "utf8",
  );
}

export async function listApprovalRecords(paths: ApprovalsPaths): Promise<ApprovalRecord[]> {
  await ensureApprovalsDirs(paths);
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(paths.records);
  const records: ApprovalRecord[] = [];
  for (const f of files.filter((n) => n.endsWith(".json"))) {
    records.push(
      JSON.parse(await readFile(`${paths.records}/${f}`, "utf8")) as ApprovalRecord,
    );
  }
  return records;
}
