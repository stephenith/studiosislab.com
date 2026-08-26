/**
 * Runtime Plan V1 — types (Agent #169).
 * Planning only. Never dispatches, executes, or publishes.
 */

export const RUNTIME_PLAN_SCHEMA_VERSION = "runtime-plan-1.0.0" as const;

export type RuntimePlanLifecycleStatus =
  | "RUNTIME_PLAN_READY"
  | "RUNTIME_PLAN_BLOCKED";

export type RuntimePlanNodeKind =
  | "director"
  | "manager"
  | "worker"
  | "skill"
  | "model"
  | "tool"
  | "stage";

export type RuntimePlanNode = {
  id: string;
  kind: RuntimePlanNodeKind;
  label: string;
  order: number;
  invoked: false;
  informational: true;
};

export type RuntimePlanEdge = {
  from: string;
  to: string;
  kind: "depends_on" | "orchestrates" | "uses" | "sequential";
};

export type RuntimeExecutionGraph = {
  nodes: RuntimePlanNode[];
  edges: RuntimePlanEdge[];
  critical_path: string[];
  topological_order: string[];
  note: string;
};

export type RuntimeDependencyGraph = {
  nodes: string[];
  edges: Array<{ from: string; to: string; kind: string }>;
  critical_path: string[];
  cycles: string[][];
  missing_dependencies: string[];
  duplicate_workers: string[];
  invalid_ordering: string[];
  acyclic: boolean;
  note: string;
};

export type RuntimeWorkerResolution = {
  director: string[];
  managers: string[];
  workers: string[];
  skills: string[];
  models: string[];
  tools: string[];
  worker_order: string[];
  missing_workers: string[];
  missing_skills: string[];
  missing_models: string[];
  missing_tools: string[];
  note: string;
};

export type RuntimeQualityGate = {
  id: string;
  label: string;
  required: boolean;
  satisfied: boolean | null;
  note: string;
};

export type RuntimeRollbackPoint = {
  id: string;
  label: string;
  description: string;
  implemented: false;
};

export type RuntimeExecutionPlan = {
  schema_version: typeof RUNTIME_PLAN_SCHEMA_VERSION;
  runtime_plan_id: string;
  shadow_queue_id: string;
  mission_id: string;
  mission_version: number;
  submission_id: string;
  execution_package_checksum: string;
  submission_checksum: string;
  acknowledgement_checksum: string;
  department: string;
  priority: string;
  worker_order: string[];
  execution_graph: RuntimeExecutionGraph;
  dependency_graph: RuntimeDependencyGraph;
  worker_resolution: RuntimeWorkerResolution;
  estimated_duration: string;
  estimated_cost_usd: number | null;
  estimated_cost_note: string;
  quality_gates: RuntimeQualityGate[];
  rollback_points: RuntimeRollbackPoint[];
  missing_workers: string[];
  missing_skills: string[];
  missing_models: string[];
  missing_tools: string[];
  warnings: string[];
  plan_status: RuntimePlanLifecycleStatus;
  plan_checksum: string;
  planning_only: true;
  dispatch_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  created_at: string;
  created_by: "runtime_planner";
  next_safe_action: string;
  planning_still_blocked_reason: string;
  fixture?: boolean;
};

export type RuntimePlanEvent = {
  event_id: string;
  event_type:
    | "PLAN_BUILT"
    | "PLAN_VALIDATED"
    | "PLAN_BLOCKED"
    | "PLAN_REJECTED"
    | "MISSION_STATUS_UPDATED";
  at: string;
  mission_id: string;
  runtime_plan_id: string | null;
  shadow_queue_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type RuntimePlanSnapshot = {
  schema_version: "runtime-plan-snapshot-1.0.0";
  updated_at: string;
  mission_id: string | null;
  runtime_plan_id: string | null;
  shadow_queue_id: string | null;
  plan_status: RuntimePlanLifecycleStatus | "EMPTY" | null;
  plan_checksum: string | null;
  planning_only: true;
  dispatch_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  next_safe_action: string | null;
};

export type RuntimePlanHealth = {
  schema_version: "runtime-plan-health-1.0.0";
  updated_at: string;
  plan_count: number;
  ready_count: number;
  blocked_count: number;
  planning_only: true;
  dispatch_allowed: false;
  execution_allowed: false;
  publishing_allowed: false;
  live: false;
  mode: "planning_only";
  status: "healthy" | "degraded" | "idle";
};

export type RuntimePlanBuildResult = {
  ok: boolean;
  plan: RuntimeExecutionPlan | null;
  mission_status: string | null;
  next_safe_action: string | null;
  artifact_paths: string[];
  error?: string;
  error_code?: string;
  duplicate?: boolean;
};

export const RUNTIME_PLAN_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "provider",
  "publish",
] as const;
