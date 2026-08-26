/**
 * Event Bus — shared types.
 * AGENT #105 — AI OS Event Bus & Automation Engine V1
 */

export type EventType =
  | "SYSTEM_START"
  | "SYSTEM_STOP"
  | "SYSTEM_HEALTHY"
  | "SYSTEM_WARNING"
  | "SYSTEM_CRITICAL"
  | "WEBSITE_WARNING"
  | "WEBSITE_HEALTHY"
  | "TIMELINE_REMINDER"
  | "SECURITY_WARNING"
  | "SECURITY_CRITICAL"
  | "RUNTIME_RESTART"
  | "FOUNDER_REVIEW_PENDING"
  | "PUBLICATION_READY"
  | "PUBLICATION_RELEASED"
  | "BATCH_COMPLETED"
  | "NOTIFICATION_READY"
  | "CUSTOM_EVENT";

export type DepartmentId =
  | "runtime-manager"
  | "security-department"
  | "timeline-department"
  | "notification-department"
  | "website-department"
  | "resume-factory"
  | "scheduler"
  | "production-dashboard"
  | "founder-dashboard"
  | "catalog-integrity"
  | "batch-release";

export type EventPayload = Record<string, unknown>;

export type BusEvent = {
  id: string;
  type: EventType;
  source: string;
  payload: EventPayload;
  created_at: string;
  correlation_id?: string;
};

export type EventHandler = (event: BusEvent) => void | Promise<void>;

export type Subscription = {
  id: string;
  department: DepartmentId | string;
  event_type: EventType | "*";
  handler_label: string;
  created_at: string;
};

export type RegisteredDepartment = {
  id: DepartmentId;
  label: string;
  module_path: string;
  available: boolean;
  registered: true;
  subscribed_events: Array<EventType | "*">;
};

export type AutomationRule = {
  id: string;
  name: string;
  trigger: EventType;
  actions: Array<{
    target_department: DepartmentId;
    emit?: EventType;
    intent: string;
  }>;
  enabled: boolean;
};

export type RoutedDelivery = {
  event_id: string;
  event_type: EventType;
  target_department: DepartmentId | string;
  status: "delivered" | "queued" | "skipped";
  at: string;
  note: string;
};

export type AutomationTrace = {
  rule_id: string;
  trigger_event_id: string;
  trigger_type: EventType;
  actions_taken: Array<{
    target_department: DepartmentId;
    emit?: EventType;
    intent: string;
    status: "applied";
  }>;
  at: string;
};

export type EventBusResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  departments: RegisteredDepartment[];
  events_registered: EventType[];
  rules: AutomationRule[];
  history: BusEvent[];
  deliveries: RoutedDelivery[];
  automation_traces: AutomationTrace[];
  subscriptions: Subscription[];
  checks: Record<string, boolean>;
  output_dir: string;
};
