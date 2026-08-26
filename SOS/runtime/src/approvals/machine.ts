import type { ApprovalFsmState, ApprovalRecord } from "./types.js";

export function createPendingRecord(
  approvalId: string,
  taskId: string,
  correlationId: string,
): ApprovalRecord {
  const now = new Date().toISOString();
  return {
    approval_id: approvalId,
    correlation_id: correlationId,
    task_id: taskId,
    state: "pending",
    created_at: now,
    updated_at: now,
  };
}

export function transitionApproved(record: ApprovalRecord): ApprovalRecord {
  return { ...record, state: "approved", received_at: new Date().toISOString() };
}

export function transitionPmResume(record: ApprovalRecord): ApprovalRecord {
  return {
    ...record,
    state: "pm_resume",
    pm_resume_at: new Date().toISOString(),
  };
}

export function transitionCompleted(record: ApprovalRecord): ApprovalRecord {
  return {
    ...record,
    state: "completed",
    completed_at: new Date().toISOString(),
  };
}

export function transitionRejected(record: ApprovalRecord): ApprovalRecord {
  return { ...record, state: "rejected", received_at: new Date().toISOString() };
}

export function transitionClosed(record: ApprovalRecord): ApprovalRecord {
  return {
    ...record,
    state: "closed",
    closed_at: new Date().toISOString(),
  };
}

export function transitionDeferred(record: ApprovalRecord): ApprovalRecord {
  return { ...record, state: "deferred", received_at: new Date().toISOString() };
}

export function isTerminalState(state: ApprovalFsmState): boolean {
  return state === "completed" || state === "closed";
}
