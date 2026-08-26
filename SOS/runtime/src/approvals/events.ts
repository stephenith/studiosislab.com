import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ApprovalsPaths } from "./paths.js";
import type { ParsedCommanderDecision } from "./types.js";
import type { EventEnvelope } from "../types.js";

export async function appendApprovalEvent(
  paths: ApprovalsPaths,
  event: EventEnvelope,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(paths.events, `${date}.jsonl`);
  await mkdir(paths.events, { recursive: true });
  await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
}

export function buildApprovalResponseEvent(
  approvalId: string,
  correlationId: string,
  decision: ParsedCommanderDecision,
): EventEnvelope {
  const approvalStatus =
    decision.command === "APPROVE" || decision.command === "DELEGATE" ? "approved"
    : decision.command === "REJECT" || decision.command === "CANCEL" ? "rejected"
    : decision.command === "DEFER" ? "deferred"
    : "not_required";

  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-approvals",
    agent: "system",
    type: "approval_response",
    priority: decision.command === "ESTOP" || decision.priority_level === "P0" ? "P0" : "P2",
    title: `Commander decision: ${decision.command}`,
    body: decision.raw,
    correlation_id: correlationId,
    requires_approval: false,
    approval_status: approvalStatus,
    metadata: {
      approval_id: approvalId,
      option_key: decision.option_key,
      notes: decision.notes,
      defer_hours: decision.defer_hours,
      priority_level: decision.priority_level,
      delegate_target: decision.delegate_target,
      commander_command: decision.command,
    },
  };
}

export function buildMetaCommandEvent(
  approvalId: string | null,
  correlationId: string,
  decision: ParsedCommanderDecision,
): EventEnvelope {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-approvals",
    agent: "system",
    type: "info",
    priority: decision.command === "ESTOP" ? "P0" : "P1",
    title: `Commander meta command: ${decision.command}`,
    body: decision.raw,
    correlation_id: correlationId,
    requires_approval: false,
    approval_status: "not_required",
    metadata: {
      approval_id: approvalId,
      commander_command: decision.command,
      priority_level: decision.priority_level,
      delegate_target: decision.delegate_target,
    },
  };
}
