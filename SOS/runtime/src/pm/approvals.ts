import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { dispatchEvent } from "../dispatcher.js";
import type { EventEnvelope } from "../types.js";
import type { PmPaths } from "./paths.js";
import type { PmState, Task, WaitingApproval } from "./types.js";
import type { CdeEvaluation } from "./cde.js";
import {
  buildApprovalEvent,
  buildApprovalPendingMarkdown,
  buildCcpPacket,
  formatCcpEmail,
  generateApprovalId,
  generateMessageId,
  parseCommanderReply,
} from "./ccp.js";
import { appendEventForDispatch } from "./events.js";
import { saveState } from "./state.js";
import { logDispatch, approvalIdFromEvent } from "../dispatch-logger.js";

async function dispatchApprovalSafely(
  config: RuntimeConfig,
  event: EventEnvelope,
): Promise<void> {
  const approvalId = approvalIdFromEvent(event);

  try {
    const result = await dispatchEvent(config, event);
    await logDispatch(config, {
      message: "delivery_result",
      event_id: event.event_id,
      approval_id: approvalId,
      delivery_result: result,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await logDispatch(config, {
      message: "dispatch_error",
      event_id: event.event_id,
      approval_id: approvalId,
      error,
    });
  }
}

export type ApprovalResponse = {
  approval_id: string;
  correlation_id: string;
  task_id: string;
  command: string;
  option_key?: string;
  notes?: string;
  defer_hours?: number;
  received_at: string;
  raw: string;
};

export async function submitApprovalRequest(
  config: RuntimeConfig,
  paths: PmPaths,
  state: PmState,
  task: Task,
  evaluation: CdeEvaluation,
  seq: number,
  resumeStage: WaitingApproval["resume_stage"] = "pre_dev",
): Promise<{ approvalId: string; event: EventEnvelope }> {
  const approvalId = generateApprovalId(new Date(), seq);
  const messageId = generateMessageId(new Date(), seq, "OUT");
  const replyTo = process.env.SOS_APPROVAL_REPLY_TO?.trim() || config.notifyFrom.match(/<([^>]+)>/)?.[1] || "approvals@studiosis.in";

  const { envelope, body } = buildCcpPacket(
    task,
    evaluation,
    approvalId,
    messageId,
    replyTo,
  );

  const ccpBody = formatCcpEmail(envelope, body);
  const event = buildApprovalEvent(task, envelope, ccpBody);

  await appendEventForDispatch(config, paths, event);

  if (existsSync(paths.pendingApprovals)) {
    const pending = await readFile(paths.pendingApprovals, "utf8");
    const addition = buildApprovalPendingMarkdown(envelope, task, evaluation);
    await writeFile(paths.pendingApprovals, `${pending.trimEnd()}\n${addition}\n`, "utf8");
  }

  const responsePath = join(paths.approvalResponses, `${approvalId}.json`);

  await dispatchApprovalSafely(config, event);

  const waiting: WaitingApproval = {
    approval_id: approvalId,
    task_id: task.task_id,
    correlation_id: task.correlation_id,
    created_at: new Date().toISOString(),
    expires_at: envelope.expires_at,
    ccp_message_id: messageId,
    event_id: event.event_id,
    resume_stage: resumeStage,
  };

  state.waiting_approvals.push(waiting);
  state.interruption_budget.approvals_sent += 1;
  state.interruption_budget.total_sent += 1;
  if (evaluation.priority === "P0") state.interruption_budget.p0_sent += 1;

  await writeFile(
    responsePath,
    JSON.stringify({ status: "pending", approval_id: approvalId, task_id: task.task_id }, null, 2),
    "utf8",
  );

  return { approvalId, event };
}

export async function checkApprovalResponse(
  paths: PmPaths,
  approvalId: string,
): Promise<ApprovalResponse | null> {
  const file = join(paths.approvalResponses, `${approvalId}.json`);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  const data = JSON.parse(raw) as ApprovalResponse & { status?: string };
  if (data.status === "pending") return null;
  if (data.command) return data;
  return null;
}

export async function recordApprovalResponse(
  paths: PmPaths,
  approvalId: string,
  rawCommand: string,
  taskId: string,
  correlationId: string,
): Promise<ApprovalResponse | null> {
  const parsed = parseCommanderReply(rawCommand);
  if (!parsed) return null;

  const response: ApprovalResponse = {
    approval_id: approvalId,
    correlation_id: correlationId,
    task_id: taskId,
    command: parsed.command,
    option_key: parsed.option_key,
    notes: parsed.notes,
    defer_hours: parsed.defer_hours,
    received_at: new Date().toISOString(),
    raw: rawCommand.trim(),
  };

  const file = join(paths.approvalResponses, `${approvalId}.json`);
  await writeFile(file, JSON.stringify(response, null, 2), "utf8");

  const decisionFile = join(
    paths.decisions,
    `${new Date().toISOString().slice(0, 10)}_${approvalId}.md`,
  );
  await appendFile(
    decisionFile,
    `# Decision ${approvalId}\n\n**Command:** ${parsed.command}${parsed.option_key ? ` ${parsed.option_key}` : ""}\n**Task:** ${taskId}\n**Time:** ${response.received_at}\n${parsed.notes ? `**Notes:** ${parsed.notes}\n` : ""}`,
    "utf8",
  );

  return response;
}

export function isApprovalGranted(response: ApprovalResponse): boolean {
  return response.command === "APPROVE";
}

export function isApprovalRejected(response: ApprovalResponse): boolean {
  return response.command === "REJECT";
}

export function isApprovalDeferred(response: ApprovalResponse): boolean {
  return response.command === "DEFER";
}

export async function removeWaitingApproval(
  state: PmState,
  paths: PmPaths,
  approvalId: string,
): Promise<void> {
  state.waiting_approvals = state.waiting_approvals.filter(
    (w) => w.approval_id !== approvalId,
  );
  await saveState(paths, state);
}
