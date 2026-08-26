/**
 * Company Brain Planning Engine V1 — types (Agent #161).
 * Planning only. Never executes work, enqueues jobs, or calls providers.
 */

export type PlanPriority = "P0" | "P1" | "P2" | "P3";

export type PlanRiskLevel = "low" | "medium" | "high" | "critical";

export type PlanExecutionStatus =
  | "PLANNED"
  | "AWAITING_FOUNDER_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "SUPERSEDED";

export type DepartmentId =
  | "resume"
  | "website"
  | "seo"
  | "marketing"
  | "publisher"
  | "finance"
  | "support";

export type DepartmentPlanRole = {
  department: DepartmentId;
  label: string;
  enabled: boolean;
  role_in_plan: "primary" | "supporting" | "informational" | "blocked";
  notes: string;
};

export type PlanBlocker = {
  id: string;
  severity: "blocker" | "warning";
  code: string;
  message: string;
  source: string;
};

export type RequiredWorker = {
  worker_type: string;
  capability: string;
  department: DepartmentId | "shared";
  count: number;
  notes: string;
};

export type PlanDependency = {
  id: string;
  kind: "module" | "artifact" | "approval" | "provider" | "queue" | "department";
  description: string;
  satisfied: boolean;
};

/** Company Brain ExecutionPlan — distinct from runtime/chief ExecutionPlan. */
export type CompanyExecutionPlan = {
  schema_version: "company-brain-plan-1.0.0";
  mission_id: string;
  plan_id: string;
  objective: string;
  priority: PlanPriority;
  departments_involved: DepartmentPlanRole[];
  recommended_order: DepartmentId[];
  required_workers: RequiredWorker[];
  estimated_dependencies: PlanDependency[];
  blocking_issues: PlanBlocker[];
  risk_level: PlanRiskLevel;
  founder_approval_required: true;
  execution_status: PlanExecutionStatus;
  /** Always false in V1 — Company Brain never executes. */
  execution_allowed: false;
  /** Always false in V1 — never enqueues. */
  queue_enqueue_allowed: false;
  canonical_engine: "core.first-production-cycle";
  created_at: string;
  planning_notes: string[];
  inputs_used: {
    founder_objective: string;
    dashboard_snapshot_available: boolean;
    knowledge_available: boolean;
    queue_summary_available: boolean;
    provider_validation_status: string | null;
    pending_founder_reviews: number;
    runtime_health: string;
  };
};

export type CompanyBrainStatus = {
  module: "company-brain";
  version: "1.0.0";
  mode: "planning_only";
  autonomous: false;
  can_execute: false;
  can_enqueue: false;
  can_call_providers: false;
  can_publish: false;
  planning_state: "idle" | "planned" | "blocked" | "awaiting_founder";
  current_objective: string | null;
  latest_plan_id: string | null;
  pending_approval: boolean;
  latest_plan: CompanyExecutionPlan | null;
  generated_at: string;
  source: string;
  /** Mission Contract V1 (Agent #162) — optional until a mission is created */
  current_mission_id?: string | null;
  current_mission_status?: string | null;
  current_mission_name?: string | null;
  current_mission_priority?: PlanPriority | null;
  current_mission_risk?: PlanRiskLevel | null;
  current_mission_progress_pct?: number | null;
  founder_approval_status?: string | null;
};

export type PlanningInput = {
  founder_objective: string;
  /** Optional override paths for verify isolation */
  repo_root?: string;
  /** When true, still never executes — only affects fixture labeling */
  fixture?: boolean;
};

export type PlanningResult = {
  overall: "PASS" | "FAIL";
  plan: CompanyExecutionPlan;
  status: CompanyBrainStatus;
  persisted: boolean;
  artifact_paths: string[];
};
