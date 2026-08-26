import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState } from "../pm/state.js";
import { recordApprovalResponse } from "../pm/approvals.js";
import type { ApprovalsPaths } from "./paths.js";
import { getApprovalsPaths } from "./paths.js";
import {
  loadApprovalRecord,
  saveApprovalRecord,
  loadApprovalsState,
  saveApprovalsState,
} from "./state.js";
import {
  parseCommanderDecision,
  toPmResponseCommand,
  isPmResolvableCommand,
} from "./parser.js";
import {
  createPendingRecord,
  transitionApproved,
  transitionPmResume,
  transitionCompleted,
  transitionRejected,
  transitionClosed,
  transitionDeferred,
  isTerminalState,
} from "./machine.js";
import { triggerPmResume } from "./resume.js";
import { appendApprovalEvent, buildApprovalResponseEvent, buildMetaCommandEvent } from "./events.js";
import type { InboxMessage, ProcessResult } from "./types.js";

type ApprovalContext = {
  task_id: string;
  correlation_id: string;
};

async function resolveApprovalContext(
  paths: ApprovalsPaths,
  approvalId: string,
  msg?: InboxMessage,
): Promise<ApprovalContext | null> {
  if (msg?.correlation_id) {
    const stub = await readPmResponseStub(paths, approvalId);
    return {
      task_id: stub?.task_id ?? "",
      correlation_id: msg.correlation_id,
    };
  }

  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  const waiting = pmState.waiting_approvals.find((w) => w.approval_id === approvalId);
  if (waiting) {
    return { task_id: waiting.task_id, correlation_id: waiting.correlation_id };
  }

  const stub = await readPmResponseStub(paths, approvalId);
  if (stub?.task_id) {
    return {
      task_id: stub.task_id,
      correlation_id: stub.correlation_id ?? msg?.correlation_id ?? "",
    };
  }

  const existing = await loadApprovalRecord(paths, approvalId);
  if (existing) {
    return { task_id: existing.task_id, correlation_id: existing.correlation_id };
  }

  return null;
}

async function readPmResponseStub(
  paths: ApprovalsPaths,
  approvalId: string,
): Promise<{ task_id?: string; correlation_id?: string; status?: string } | null> {
  const file = join(paths.pmResponses, `${approvalId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as {
    task_id?: string;
    correlation_id?: string;
    status?: string;
  };
}

export async function syncPendingFromPm(paths: ApprovalsPaths): Promise<number> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  let synced = 0;

  for (const waiting of pmState.waiting_approvals) {
    const existing = await loadApprovalRecord(paths, waiting.approval_id);
    if (existing && !isTerminalState(existing.state)) continue;

    const record = createPendingRecord(
      waiting.approval_id,
      waiting.task_id,
      waiting.correlation_id,
    );
    await saveApprovalRecord(paths, record);
    synced += 1;
  }

  return synced;
}

export async function processCommanderDecision(
  paths: ApprovalsPaths,
  msg: InboxMessage,
): Promise<ProcessResult> {
  const schemaError = validateMessage(msg);
  if (schemaError) {
    return { ok: false, approval_id: msg.approval_id, record_state: "pending", pm_resumed: false, error: schemaError };
  }

  const decision = parseCommanderDecision(msg.command);
  if (!decision) {
    return {
      ok: false,
      approval_id: msg.approval_id,
      record_state: "pending",
      pm_resumed: false,
      error: `Invalid CCP syntax: ${msg.command}`,
    };
  }

  const context = await resolveApprovalContext(paths, msg.approval_id, msg);
  if (!context?.task_id || !context.correlation_id) {
    return {
      ok: false,
      approval_id: msg.approval_id,
      record_state: "pending",
      pm_resumed: false,
      error: `No pending approval context for ${msg.approval_id}`,
    };
  }

  let record = await loadApprovalRecord(paths, msg.approval_id);
  if (!record) {
    record = createPendingRecord(msg.approval_id, context.task_id, context.correlation_id);
  }

  record.raw_command = decision.raw;
  record.command = decision.command;
  record.option = decision.option_key ?? msg.option;
  record.notes = decision.notes ?? msg.notes;

  const runtimeState = await loadApprovalsState(paths);

  if (decision.command === "ESTOP") {
    runtimeState.estop_active = true;
    record.estop = true;
    record.state = "closed";
    record.closed_at = new Date().toISOString();
    await saveApprovalRecord(paths, record);
    await appendApprovalEvent(
      paths,
      buildMetaCommandEvent(msg.approval_id, context.correlation_id, decision),
    );
    runtimeState.last_processed_at = new Date().toISOString();
    await saveApprovalsState(paths, runtimeState);
    return { ok: true, approval_id: msg.approval_id, record_state: "closed", pm_resumed: false };
  }

  if (decision.command === "PRIORITY") {
    record.priority_override = decision.priority_level;
    await saveApprovalRecord(paths, record);
    await appendApprovalEvent(
      paths,
      buildMetaCommandEvent(msg.approval_id, context.correlation_id, decision),
    );
    runtimeState.last_processed_at = new Date().toISOString();
    await saveApprovalsState(paths, runtimeState);
    return { ok: true, approval_id: msg.approval_id, record_state: record.state, pm_resumed: false };
  }

  if (!isPmResolvableCommand(decision.command)) {
    return {
      ok: false,
      approval_id: msg.approval_id,
      record_state: record.state,
      pm_resumed: false,
      error: `Unsupported command for PM resume: ${decision.command}`,
    };
  }

  const pmCommand = toPmResponseCommand(decision);
  const response = await recordApprovalResponse(
    getPmPaths(loadConfig()),
    msg.approval_id,
    pmCommand,
    context.task_id,
    context.correlation_id,
  );

  if (!response) {
    record.parse_error = `Failed to record PM response for: ${pmCommand}`;
    await saveApprovalRecord(paths, record);
    return {
      ok: false,
      approval_id: msg.approval_id,
      record_state: record.state,
      pm_resumed: false,
      error: record.parse_error,
    };
  }

  await appendApprovalEvent(
    paths,
    buildApprovalResponseEvent(msg.approval_id, context.correlation_id, decision),
  );

  let pmResumed = false;

  if (decision.command === "APPROVE" || decision.command === "DELEGATE") {
    record = transitionApproved({ ...record, ...context });
    await saveApprovalRecord(paths, record);
    record = transitionPmResume(record);
    await saveApprovalRecord(paths, record);

    await triggerPmResume(paths, {
      approval_id: msg.approval_id,
      task_id: context.task_id,
      correlation_id: context.correlation_id,
      command: pmCommand,
      triggered_at: new Date().toISOString(),
      source: "approvals_listener",
    });
    pmResumed = true;

    record = transitionCompleted(record);
    await saveApprovalRecord(paths, record);
  } else if (decision.command === "REJECT" || decision.command === "CANCEL") {
    record = transitionRejected({ ...record, ...context });
    await saveApprovalRecord(paths, record);
    record = transitionClosed(record);
    await saveApprovalRecord(paths, record);

    await triggerPmResume(paths, {
      approval_id: msg.approval_id,
      task_id: context.task_id,
      correlation_id: context.correlation_id,
      command: pmCommand,
      triggered_at: new Date().toISOString(),
      source: "approvals_listener",
    });
    pmResumed = true;
  } else if (decision.command === "DEFER") {
    record = transitionDeferred({ ...record, ...context });
    await saveApprovalRecord(paths, record);
    record = transitionClosed(record);
    await saveApprovalRecord(paths, record);

    await triggerPmResume(paths, {
      approval_id: msg.approval_id,
      task_id: context.task_id,
      correlation_id: context.correlation_id,
      command: pmCommand,
      triggered_at: new Date().toISOString(),
      source: "approvals_listener",
    });
    pmResumed = true;
  }

  runtimeState.last_processed_at = new Date().toISOString();
  await saveApprovalsState(paths, runtimeState);

  return {
    ok: true,
    approval_id: msg.approval_id,
    record_state: record.state,
    pm_resumed: pmResumed,
  };
}

function validateMessage(msg: InboxMessage): string | null {
  if (!msg.approval_id.match(/^APP-\d{8}-\d{3}$/)) {
    return `Invalid approval_id: ${msg.approval_id}`;
  }
  if (!msg.command?.trim()) return "Missing command";
  return null;
}

export function getApprovalsRuntime(config?: RuntimeConfig): ApprovalsPaths {
  return getApprovalsPaths(config ?? loadConfig());
}
