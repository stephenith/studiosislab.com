/**
 * Telemetry types — Agent #183.
 * Contracts only. No collection. No emission.
 */

export const TELEMETRY_SCHEMA_VERSION = "telemetry-1.0.0" as const;
export const TELEMETRY_SESSION_SCHEMA_VERSION =
  "telemetry-session-1.0.0" as const;
export const TELEMETRY_EVENT_CATALOGUE_VERSION =
  "telemetry-event-catalogue-1.0.0" as const;
export const TELEMETRY_SNAPSHOT_VERSION =
  "telemetry-registry-snapshot-1.0.0" as const;
export const TELEMETRY_HEALTH_VERSION = "telemetry-health-1.0.0" as const;

export const TELEMETRY_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  worker_spawn_allowed: false,
  queue_insert_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  live_enabled: false,
  collection_allowed: false,
  emission_allowed: false,
} as const;

export type TelemetrySafetyFlags = typeof TELEMETRY_SAFETY_FLAGS;

export type TelemetryLifecycleStatus =
  | "CREATED"
  | "READY"
  | "ATTACHED"
  | "FROZEN";

export type TelemetryEventKind =
  | "MISSION_CREATED"
  | "MISSION_APPROVED"
  | "PACKAGE_ACKNOWLEDGED"
  | "QUEUE_READY"
  | "RUNTIME_PLAN_READY"
  | "EXECUTION_CONTROLLER_READY"
  | "WORKER_ASSIGNED"
  | "WORKER_READY"
  | "SYSTEM_READY";

export type TelemetryChecksums = {
  session_checksum: string;
  correlation_checksum: string | null;
  timeline_checksum: string | null;
  controller_ref: string | null;
  worker_runtime_ref: string | null;
  cost_session_ref: string | null;
};

export type TelemetrySessionContract = {
  schema_version: typeof TELEMETRY_SESSION_SCHEMA_VERSION;
  telemetry_session_id: string;
  mission_id: string;
  execution_controller_id: string | null;
  department_id: string | null;
  worker_runtime_id: string | null;
  cost_session_id: string | null;
  runtime_plan_id: string | null;
  runtime_release_id: string | null;
  system_readiness_id: string | null;
  correlation_id: string | null;
  timeline_id: string | null;
  status: TelemetryLifecycleStatus;
  checksums: TelemetryChecksums;
  version: string;
  collection_enabled: false;
  emission_enabled: false;
  safety_flags: TelemetrySafetyFlags;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type TelemetryEventCatalogueEntry = {
  event_kind: TelemetryEventKind;
  description: string;
  emitted: false;
  collectable: false;
};

export type TelemetryEventRecord = {
  event_id: string;
  event_kind: TelemetryEventKind;
  telemetry_session_id: string | null;
  at: string | null;
  summary: string;
  /** V1: catalogue metadata only — never emitted */
  emitted: false;
};

export type TelemetryTimelineContract = {
  timeline_id: string;
  telemetry_session_id: string;
  ordered_event_kinds: TelemetryEventKind[];
  timestamps: Record<string, string | null>;
  dependencies: string[];
  parent_timeline_id: string | null;
  child_timeline_ids: string[];
  timeline_checksum: string;
  activated: false;
  created_at: string;
  notes: string[];
  fixture?: boolean;
};

export type TelemetrySnapshotContract = {
  snapshot_id: string;
  session_id: string;
  health: "idle" | "declared" | "unknown";
  progress_pct: number | null;
  status: TelemetryLifecycleStatus | "EMPTY";
  warnings: string[];
  collected: false;
  created_at: string;
  notes: string[];
  fixture?: boolean;
};

export type TelemetryCorrelationContract = {
  correlation_id: string;
  mission_id: string | null;
  execution_controller_id: string | null;
  department_id: string | null;
  worker_runtime_id: string | null;
  cost_session_id: string | null;
  runtime_plan_id: string | null;
  telemetry_session_id: string | null;
  correlation_checksum: string;
  linked_at_runtime: false;
  created_at: string;
  notes: string[];
  fixture?: boolean;
};

export type TelemetryRegistrySnapshot = {
  schema_version: typeof TELEMETRY_SNAPSHOT_VERSION;
  updated_at: string;
  session_count: number;
  timeline_count: number;
  correlation_count: number;
  snapshot_count: number;
  event_catalogue_count: number;
  latest_session_id: string | null;
  next_safe_action: string;
  safety_flags: TelemetrySafetyFlags;
};

export type TelemetryHealth = {
  schema_version: typeof TELEMETRY_HEALTH_VERSION;
  updated_at: string;
  session_count: number;
  timeline_count: number;
  correlation_count: number;
  status: "idle" | "healthy" | "degraded";
  mode: "telemetry_contracts_only";
  collection: false;
  emission: false;
  safety_flags: TelemetrySafetyFlags;
  live: false;
};

export type TelemetryValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type TelemetryValidationResult = {
  ok: boolean;
  errors: TelemetryValidationIssue[];
};

export type TelemetrySessionSummary = {
  telemetry_session_id: string;
  mission_id: string;
  status: TelemetryLifecycleStatus;
  correlation_id: string | null;
  timeline_id: string | null;
  worker_runtime_id: string | null;
  cost_session_id: string | null;
  validation_ok: boolean;
};

export const TELEMETRY_EVENT_CATALOGUE: TelemetryEventCatalogueEntry[] = [
  {
    event_kind: "MISSION_CREATED",
    description: "Mission contract created",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "MISSION_APPROVED",
    description: "Founder approved mission",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "PACKAGE_ACKNOWLEDGED",
    description: "Execution package acknowledged",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "QUEUE_READY",
    description: "Queue admission / shadow ready",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "RUNTIME_PLAN_READY",
    description: "Runtime plan ready",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "EXECUTION_CONTROLLER_READY",
    description: "Execution controller scaffold ready",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "WORKER_ASSIGNED",
    description: "Worker assignment recorded",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "WORKER_READY",
    description: "Worker runtime ready (metadata)",
    emitted: false,
    collectable: false,
  },
  {
    event_kind: "SYSTEM_READY",
    description: "System readiness freeze certified",
    emitted: false,
    collectable: false,
  },
];
