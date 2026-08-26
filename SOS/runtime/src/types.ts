export type Agent =
  | "pm"
  | "developer"
  | "qa"
  | "documentation"
  | "deploy"
  | "research"
  | "seo"
  | "marketing"
  | "dispatcher"
  | "system";

export type EventType =
  | "task_request"
  | "task_assigned"
  | "task_progress"
  | "task_complete"
  | "blocker"
  | "failure"
  | "approval_request"
  | "approval_response"
  | "escalation"
  | "info";

export type ApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "deferred";

export type Priority = "P0" | "P1" | "P2" | "P3";

export type EventEnvelope = {
  event_id: string;
  timestamp: string;
  tenant_id: string;
  repo_id: string;
  project_id?: string;
  agent: Agent;
  type: EventType;
  priority: Priority;
  title: string;
  body: string;
  evidence?: string[];
  correlation_id: string;
  requires_approval: boolean;
  approval_status: ApprovalStatus;
  metadata?: Record<string, unknown>;
};

export type DeliveryChannel = "telegram" | "email";

export type DeliveryStatus = "sent" | "failed" | "skipped" | "queued" | "dry_run";

export type DeliveryRecord = {
  delivery_id: string;
  timestamp: string;
  event_id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  attempt: number;
  priority: Priority;
  error?: string;
  external_id?: string;
  approval_id?: string;
};

export type RetryEntry = {
  event: EventEnvelope;
  channel: DeliveryChannel;
  attempt: number;
  next_attempt_at: string;
  last_error?: string;
  created_at: string;
};

export type DeadLetterEntry = {
  event: EventEnvelope;
  channel: DeliveryChannel;
  attempts: number;
  final_error: string;
  dead_lettered_at: string;
};

export type DispatchResult = {
  event_id: string;
  priority: Priority;
  channels: Array<{
    channel: DeliveryChannel;
    status: DeliveryStatus;
    error?: string;
  }>;
};
