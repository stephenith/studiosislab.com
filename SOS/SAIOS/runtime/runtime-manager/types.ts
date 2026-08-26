/**
 * Runtime Manager — shared types.
 * AGENT #103 — AI OS Runtime & Deployment Manager V1
 */

export type RuntimeLifecycleState =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "PAUSED"
  | "RECOVERING"
  | "FAILED"
  | "SHUTTING_DOWN";

export type DepartmentId =
  | "factory-state"
  | "timeline-department"
  | "notification-department"
  | "website-department"
  | "scheduler"
  | "resume-factory"
  | "production-dashboard"
  | "founder-dashboard"
  | "release-manager"
  | "batch-release"
  | "catalog-integrity";

export type RegisteredDepartment = {
  id: DepartmentId;
  label: string;
  module_path: string;
  verify_command: string | null;
  depends_on: DepartmentId[];
  available: boolean;
  registered: true;
};

export type ProcessRecord = {
  id: DepartmentId;
  state: RuntimeLifecycleState;
  started_at: string | null;
  stopped_at: string | null;
  restart_count: number;
  last_error: string | null;
  last_health: "ok" | "degraded" | "failed" | "unknown";
  uptime_ms: number;
};

export type HeartbeatSnapshot = {
  heartbeat_id: string;
  generated_at: string;
  cycle: number;
  running_services: DepartmentId[];
  failed_services: DepartmentId[];
  uptime_ms: number;
  memory_estimate_mb: number | null;
  last_activity: string;
  next_scheduled_cycle: string;
};

export type HealthSnapshot = {
  generated_at: string;
  overall: "HEALTHY" | "DEGRADED" | "FAILED";
  departments: Array<{
    id: DepartmentId;
    available: boolean;
    process_state: RuntimeLifecycleState;
    health: ProcessRecord["last_health"];
    restart_count: number;
  }>;
  heartbeat_fresh: boolean;
  dependency_failures: string[];
  notes: string[];
};

export type RecoveryEvent = {
  at: string;
  department_id: DepartmentId;
  action: "restart_department" | "escalate";
  reason: string;
  success: boolean;
};

export type DeploymentReadiness = {
  generated_at: string;
  ready: boolean;
  checks: Record<string, boolean>;
  node_version: string;
  missing: string[];
  notes: string[];
};

export type RuntimeManagerResult = {
  generated_at: string;
  status: RuntimeLifecycleState;
  departments: RegisteredDepartment[];
  startup_order: DepartmentId[];
  processes: ProcessRecord[];
  heartbeat: HeartbeatSnapshot;
  health: HealthSnapshot;
  recovery_events: RecoveryEvent[];
  deployment: DeploymentReadiness;
  dependencies: {
    nodes: RegisteredDepartment[];
    edges: Array<{ from: DepartmentId; to: DepartmentId }>;
    startup_order: DepartmentId[];
  };
  output_dir: string;
  checks: Record<string, boolean>;
};
