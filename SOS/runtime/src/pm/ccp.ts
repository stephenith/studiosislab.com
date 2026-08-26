import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "../types.js";
import type { BacklogItem, Task } from "./types.js";
import type { CdeEvaluation } from "./cde.js";

export const CCP_VERSION = "1.0.0";

export type CcpEnvelope = {
  ccp_version: string;
  message_id: string;
  message_type: "APPROVAL" | "BLOCKER";
  timestamp: string;
  approval_id: string;
  correlation_id: string;
  priority: string;
  blocking: boolean;
  expires_at: string;
  reply_to: string;
  options: string[];
  pm_recommendation: string;
  task_ref?: string;
  agent: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function seqFromApprovalId(approvalId: string): string {
  const parts = approvalId.split("-");
  return parts[parts.length - 1] ?? "001";
}

export function generateApprovalId(date = new Date(), seq = 1): string {
  const ymd = date.toISOString().slice(0, 10);
  return `APP-${ymd.replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;
}

export function generateMessageId(date = new Date(), seq = 1, dir: "OUT" | "IN" = "OUT"): string {
  return `CCP-${formatDate(date)}-${String(seq).padStart(3, "0")}-${dir}`;
}

export function buildApprovalOptions(task: Task, evaluation: CdeEvaluation): Record<string, string> {
  if (evaluation.hard_gate_ids.includes("H10") || evaluation.hard_gate_ids.includes("H18")) {
    return {
      A: "Proceed with PM-recommended implementation path",
      B: "Defer decision 24 hours",
      C: "Reject and keep task blocked",
    };
  }
  if (evaluation.hard_gate_ids.includes("H3")) {
    return {
      A: "Authorize Developer to draft rules PR for Commander merge review",
      B: "Defer e-sign path; document accepted risk",
      C: "Reject scope change",
    };
  }
  return {
    A: "Approve task completion and close",
    B: "Approve with conditions (reply WITH NOTES)",
    C: "Reject and return to Developer",
    D: "Defer 24H",
  };
}

export function buildCcpPacket(
  task: Task,
  evaluation: CdeEvaluation,
  approvalId: string,
  messageId: string,
  replyTo: string,
): { envelope: CcpEnvelope; body: string; subject: string } {
  const optionsMap = buildApprovalOptions(task, evaluation);
  const optionKeys = Object.keys(optionsMap);
  const expires = new Date();
  expires.setHours(expires.getHours() + (evaluation.priority === "P0" ? 24 : 72));

  const envelope: CcpEnvelope = {
    ccp_version: CCP_VERSION,
    message_id: messageId,
    message_type: evaluation.hard_gate_ids.length ? "APPROVAL" : "APPROVAL",
    timestamp: new Date().toISOString(),
    approval_id: approvalId,
    correlation_id: task.correlation_id,
    priority: evaluation.priority,
    blocking: true,
    expires_at: expires.toISOString(),
    reply_to: replyTo,
    options: optionKeys,
    pm_recommendation: "A",
    task_ref: `MASTER_BACKLOG §${task.backlog_id.replace("BL-", "").replace("-", ".")}`,
    agent: "pm",
  };

  const optionsMd = optionKeys
    .map((k) => `- **${k})** ${optionsMap[k]}`)
    .join("\n");

  const body = `## SITUATION

${task.description || task.title}

## EVIDENCE

${task.evidence.map((e) => `- ${e}`).join("\n") || "- See MASTER_BACKLOG"}

## OPTIONS

${optionsMd}

## PM RECOMMENDATION

**A)** ${optionsMap.A}

## RISK

${evaluation.reason}. Incorrect decision may affect launch stability.

## TIME SENSITIVITY

${evaluation.priority === "P0" ? "Critical — respond within 24 hours." : "High — respond within 72 hours."}

## REPLY SYNTAX

Reply with ONE line (copy and edit):

APPROVE A
APPROVE B WITH NOTES your conditions here
REJECT
DEFER 24H

Approval ID: ${approvalId}
Correlation ID: ${task.correlation_id}
`;

  const subject = `[SOS ${evaluation.priority}] [APPROVAL] ${approvalId} — ${task.title.slice(0, 60)}`;

  return { envelope, body, subject };
}

export function formatCcpEmail(envelope: CcpEnvelope, body: string): string {
  return `\`\`\`ccp-envelope
${JSON.stringify(envelope, null, 2)}
\`\`\`

${body}`;
}

export function buildApprovalEvent(
  task: Task,
  envelope: CcpEnvelope,
  ccpBody: string,
): EventEnvelope {
  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tenant_id: "studiosis",
    repo_id: "studiosislab",
    project_id: "sos-pm",
    agent: "pm",
    type: "approval_request",
    priority: envelope.priority as EventEnvelope["priority"],
    title: `Approval required: ${task.title}`,
    body: ccpBody,
    evidence: task.evidence,
    correlation_id: task.correlation_id,
    requires_approval: true,
    approval_status: "pending",
    metadata: {
      approval_id: envelope.approval_id,
      message_id: envelope.message_id,
      task_id: task.task_id,
      hard_gate_ids: task.hard_gate_ids,
      ccp_version: CCP_VERSION,
    },
  };
}

export function buildApprovalPendingMarkdown(
  envelope: CcpEnvelope,
  task: Task,
  evaluation: CdeEvaluation,
): string {
  return `
## APPROVAL ${envelope.approval_id.replace("APP-", "")}

**Priority:** ${envelope.priority}  
**Agent:** pm  
**Action:** ${task.title}  
**Impact:** ${evaluation.reason}  
**Backlog ref:** MASTER_BACKLOG §${task.backlog_id.replace("BL-", "").replace("-", ".")}  
**Options:**
- A) See CCP email
- B) Defer
- C) Reject

**PM recommendation:** A  
**Blocking:** yes  
**Expires:** ${envelope.expires_at}
`;
}

export function parseCommanderReply(raw: string): {
  command: string;
  option_key?: string;
  notes?: string;
  defer_hours?: number;
} | null {
  const line = raw
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith(">"));
  if (!line) return null;

  const upper = line.toUpperCase().replace(/\s+/g, " ").trim();

  let m = upper.match(/^APPROVE ([A-Z])(?: WITH NOTES (.+))?$/);
  if (m) {
    return { command: "APPROVE", option_key: m[1], notes: m[2]?.trim() };
  }
  m = upper.match(/^REJECT(?: (.+))?$/);
  if (m) return { command: "REJECT", notes: m[1]?.trim() };
  m = upper.match(/^DEFER(?: (\d+)H)?$/);
  if (m) return { command: "DEFER", defer_hours: m[1] ? parseInt(m[1], 10) : undefined };
  if (upper === "ACK") return { command: "ACK" };

  return null;
}
