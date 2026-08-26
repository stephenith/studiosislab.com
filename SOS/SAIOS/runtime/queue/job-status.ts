/**
 * SAIOS Job Queue — job status lifecycle (v1 production)
 */
export type QueueJobStatus =
  | "QUEUED"
  | "PLANNING"
  | "RUNNING"
  | "WAITING_QA"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export const TERMINAL_JOB_STATUSES: readonly QueueJobStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const VALID_STATUS_TRANSITIONS: Record<QueueJobStatus, QueueJobStatus[]> = {
  QUEUED: ["PLANNING", "RUNNING", "CANCELLED"],
  PLANNING: ["RUNNING", "CANCELLED"],
  RUNNING: ["WAITING_QA", "FAILED", "CANCELLED"],
  WAITING_QA: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};
