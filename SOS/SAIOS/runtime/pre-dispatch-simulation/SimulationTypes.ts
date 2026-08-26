/**
 * Pre-Dispatch Simulation types — Agent #187.
 * Simulation metadata only. Never executes.
 */

export const PRE_DISPATCH_SIMULATION_SCHEMA_VERSION =
  "pre-dispatch-simulation-1.0.0" as const;
export const PRE_DISPATCH_SIMULATION_CERTIFICATE_SCHEMA_VERSION =
  "pre-dispatch-simulation-certificate-1.0.0" as const;
export const PRE_DISPATCH_SIMULATION_SNAPSHOT_VERSION =
  "pre-dispatch-simulation-snapshot-1.0.0" as const;
export const PRE_DISPATCH_SIMULATION_HEALTH_VERSION =
  "pre-dispatch-simulation-health-1.0.0" as const;
export const ARCHITECTURE_VERSION = "1.0.0-canonical-runtime-freeze" as const;

export const PRE_DISPATCH_SIMULATION_SAFETY_FLAGS = {
  execution_allowed: false,
  dispatch_allowed: false,
  queue_insert_allowed: false,
  scheduler_allowed: false,
  worker_spawn_allowed: false,
  provider_allowed: false,
  publishing_allowed: false,
  billing_allowed: false,
  telemetry_collection_enabled: false,
  learning_write_enabled: false,
  live_enabled: false,
  simulation_only: true,
} as const;

export type PreDispatchSimulationSafetyFlags =
  typeof PRE_DISPATCH_SIMULATION_SAFETY_FLAGS;

export type SimulationLifecycleStatus =
  | "CREATED"
  | "SIMULATING"
  | "SIMULATION_COMPLETE"
  | "SIMULATION_BLOCKED"
  | "STOP";

export type SimulationGraphNodeId =
  | "founder"
  | "mission"
  | "approval"
  | "queue_admission"
  | "execution_package"
  | "package_ack"
  | "queue_submission"
  | "shadow_queue"
  | "runtime_plan"
  | "runtime_release"
  | "system_readiness"
  | "activation_gate"
  | "execution_authorization"
  | "execution_controller"
  | "department"
  | "workers"
  | "learning";

export type SimulationGraphNode = {
  node_id: SimulationGraphNodeId;
  label: string;
  order: number;
  executed: false;
  simulated: true;
  depends_on: SimulationGraphNodeId[];
};

export type SimulationTimelineStep = {
  step_id: string;
  node_id: SimulationGraphNodeId;
  label: string;
  sequence: number;
  estimated_duration_ms: number;
  executed: false;
};

export type SimulationWorkerAllocation = {
  worker_id: string;
  worker_runtime_id: string;
  department_id: string;
  capability: string;
  assigned: true;
  spawned: false;
  running: false;
  completed: false;
};

export type SimulationDepartmentAllocation = {
  department_id: string;
  role: string;
  allocated: true;
  executing: false;
};

export type SimulationCostEstimate = {
  currency: "USD";
  estimated_tokens: number;
  estimated_usd: number;
  billing: false;
  provider_usage: false;
  api_usage: false;
  spend: false;
};

export type SimulationTelemetryRef = {
  telemetry_session_id: string;
  referenced: true;
  events_emitted: false;
  collection_enabled: false;
};

export type SimulationLearningRef = {
  learning_plan_id: string;
  expected_artifacts: string[];
  writes: false;
  knowledge_updates: false;
  append_operations: false;
};

export type SimulationRollbackPlan = {
  rollback_id: string;
  steps: string[];
  executable: false;
};

export type SimulationRetryPlan = {
  retry_id: string;
  max_attempts: number;
  backoff: string;
  executable: false;
};

export type SimulationArtifactFlow = {
  artifact_id: string;
  from_node: SimulationGraphNodeId;
  to_node: SimulationGraphNodeId;
  kind: string;
  produced: false;
};

export type SimulationChecksums = {
  simulation_checksum: string;
  graph_checksum: string;
  timeline_checksum: string;
  certificate_checksum: string | null;
};

export type PreDispatchSimulationContract = {
  schema_version: typeof PRE_DISPATCH_SIMULATION_SCHEMA_VERSION;
  simulation_id: string;
  mission_id: string;
  activation_id: string | null;
  authorization_id: string | null;
  execution_controller_id: string | null;
  runtime_plan_id: string | null;
  department_ids: string[];
  worker_runtime_ids: string[];
  cost_session_ids: string[];
  telemetry_session_ids: string[];
  timeline_id: string;
  graph_id: string;
  learning_plan_id: string;
  status: SimulationLifecycleStatus;
  simulation_checksum: string;
  checksums: SimulationChecksums;
  estimated_duration_ms: number;
  estimated_cost: SimulationCostEstimate;
  timeline: SimulationTimelineStep[];
  graph_nodes: SimulationGraphNode[];
  dependency_edges: Array<{ from: SimulationGraphNodeId; to: SimulationGraphNodeId }>;
  worker_allocations: SimulationWorkerAllocation[];
  department_allocations: SimulationDepartmentAllocation[];
  rollback_plan: SimulationRollbackPlan;
  retry_plan: SimulationRetryPlan;
  telemetry_refs: SimulationTelemetryRef[];
  learning_ref: SimulationLearningRef;
  artifact_flow: SimulationArtifactFlow[];
  safety_flags: PreDispatchSimulationSafetyFlags;
  execution_enabled: false;
  live_enabled: false;
  created_at: string;
  updated_at: string;
  next_safe_action: string;
  notes: string[];
  fixture?: boolean;
};

export type SimulationIntegrityScores = {
  simulation_score: number;
  graph_integrity: number;
  worker_integrity: number;
  department_integrity: number;
  timeline_integrity: number;
  cost_integrity: number;
  telemetry_integrity: number;
  learning_integrity: number;
  overall_readiness: number;
};

export type PreDispatchSimulationCertificate = {
  schema_version: typeof PRE_DISPATCH_SIMULATION_CERTIFICATE_SCHEMA_VERSION;
  certificate_id: string;
  simulation_id: string;
  mission_id: string;
  scores: SimulationIntegrityScores;
  generated_at: string;
  certificate_checksum: string;
  execution_permissions: false;
  safety_flags: PreDispatchSimulationSafetyFlags;
  notes: string[];
  fixture?: boolean;
};

export type PreDispatchSimulationHealth = {
  schema_version: typeof PRE_DISPATCH_SIMULATION_HEALTH_VERSION;
  simulation_count: number;
  complete_count: number;
  blocked_count: number;
  certificate_count: number;
  status: string;
  mode: "pre_dispatch_simulation_only";
  execution_allowed: false;
  live_enabled: false;
  safety_flags: PreDispatchSimulationSafetyFlags;
};

export type PreDispatchSimulationSnapshot = {
  schema_version: typeof PRE_DISPATCH_SIMULATION_SNAPSHOT_VERSION;
  simulation_count: number;
  complete_count: number;
  blocked_count: number;
  certificate_count: number;
  latest_simulation_id: string | null;
  latest_mission_id: string | null;
  latest_status: SimulationLifecycleStatus | null;
  overall_readiness: number | null;
  next_safe_action: string | null;
};

export type SimulationSummary = {
  simulation_id: string;
  mission_id: string;
  status: SimulationLifecycleStatus;
  overall_readiness: number | null;
  certificate_id: string | null;
  fixture?: boolean;
};

export type SimulationValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type SimulationValidationResult = {
  ok: boolean;
  errors: SimulationValidationIssue[];
};
