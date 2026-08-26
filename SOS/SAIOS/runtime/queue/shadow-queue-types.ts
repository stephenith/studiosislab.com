/**
 * Runtime Shadow Queue V1 — types (Agent #168).
 * Isolated shadow receiver. Never dispatches, executes, or publishes.
 */

export const SHADOW_QUEUE_SCHEMA_VERSION = "shadow-queue-1.0.0" as const;

export const SHADOW_QUEUE_FOUNDER_ACTOR = "stephen" as const;

export type ShadowQueueRecordStatus = "SHADOW_QUEUE_RECEIVED";

export type ShadowQueueRecord = {
  schema_version: typeof SHADOW_QUEUE_SCHEMA_VERSION;
  shadow_queue_id: string;
  submission_id: string;
  mission_id: string;
  mission_version: number;
  execution_package_id: string;
  execution_package_checksum: string;
  acknowledgement_id: string;
  acknowledgement_checksum: string;
  submission_checksum: string;
  department: string;
  priority: string;
  received_timestamp: string;
  status: ShadowQueueRecordStatus;
  validation_summary: string;
  warnings: string[];
  shadow: true;
  dispatch_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  never_consumed: true;
  never_dispatched: true;
  never_scheduled: true;
  next_safe_action: string;
  fixture?: boolean;
};

export type ShadowQueueEvent = {
  event_id: string;
  event_type:
    | "SHADOW_RECEIVED"
    | "SHADOW_REJECTED"
    | "MISSION_STATUS_UPDATED"
    | "VALIDATION_PASSED";
  at: string;
  mission_id: string;
  shadow_queue_id: string | null;
  submission_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type ShadowQueueHistoryEntry = {
  at: string;
  mission_id: string;
  mission_version: number;
  shadow_queue_id: string | null;
  submission_id: string | null;
  from_status: string;
  to_status: string;
  actor: string | null;
  note: string;
  fixture?: boolean;
};

export type ShadowQueueSnapshot = {
  schema_version: "shadow-queue-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  shadow_queue_id: string | null;
  submission_id: string | null;
  status: ShadowQueueRecordStatus | "EMPTY" | null;
  submission_checksum: string | null;
  received_count: number;
  shadow: true;
  dispatch_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  next_safe_action: string | null;
};

export type ShadowQueueHealth = {
  schema_version: "shadow-queue-health-1.0.0";
  updated_at: string;
  received_count: number;
  shadow: true;
  dispatch_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  live: false;
  mode: "shadow_receive_only";
  status: "healthy" | "degraded" | "idle";
};

export type ShadowQueueReceiveInput = {
  mission_id: string;
  mission_version: number;
  submission_id: string;
  submission_checksum: string;
  actor: string;
  reason?: string;
  notes?: string;
  fixture?: boolean;
  execute?: unknown;
  dispatch?: unknown;
  queue?: unknown;
  scheduler?: unknown;
  publish?: unknown;
  provider?: unknown;
};

export type ShadowQueueReceiveResult = {
  ok: boolean;
  record: ShadowQueueRecord | null;
  mission_status: string | null;
  next_safe_action: string | null;
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};

export const SHADOW_QUEUE_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "queue",
  "scheduler",
  "publish",
  "provider",
] as const;
