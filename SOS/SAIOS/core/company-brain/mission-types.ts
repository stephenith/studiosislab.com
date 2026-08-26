/**
 * Mission Contract V1 — canonical business object for AIOS (Agent #162).
 * Planning layer only. Never executes, enqueues, or publishes.
 */

import type {
  DepartmentId,
  DepartmentPlanRole,
  PlanBlocker,
  PlanPriority,
  PlanRiskLevel,
} from "./types.js";

export const MISSION_SCHEMA_VERSION = "mission-contract-1.0.0" as const;

/**
 * Full lifecycle.
 * Agent #162–#165: through READY_FOR_QUEUE + execution package dry-run
 * Agent #166: + WAITING_PACKAGE_ACKNOWLEDGEMENT | PACKAGE_ACKNOWLEDGED |
 *   PACKAGE_CHANGES_REQUESTED | PACKAGE_REJECTED
 * Agent #167: + WAITING_QUEUE_SUBMISSION | QUEUE_SUBMISSION_READY |
 *   QUEUE_SUBMISSION_BLOCKED (shadow submission only — no queue insert)
 * Agent #168: + SHADOW_QUEUE_RECEIVED (runtime Shadow Queue receive only)
 * Agent #169: + RUNTIME_PLAN_READY | RUNTIME_PLAN_BLOCKED (runtime planning only)
 * Agent #170: + WAITING_RUNTIME_RELEASE | RUNTIME_RELEASE_APPROVED |
 *   RUNTIME_RELEASE_REJECTED | RUNTIME_RELEASE_CHANGES_REQUESTED
 * Agent #171: + SYSTEM_READY | SYSTEM_BLOCKED (readiness freeze certificate)
 * Later stages (IN_PROGRESS+) remain placeholders — no execution.
 */
export type MissionLifecycleStatus =
  | "DRAFT"
  | "PLANNED"
  | "WAITING_FOUNDER"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "WAITING_QUEUE_REVIEW"
  | "READY_FOR_QUEUE"
  | "QUEUE_BLOCKED"
  | "WAITING_PACKAGE_ACKNOWLEDGEMENT"
  | "PACKAGE_ACKNOWLEDGED"
  | "PACKAGE_CHANGES_REQUESTED"
  | "PACKAGE_REJECTED"
  | "WAITING_QUEUE_SUBMISSION"
  | "QUEUE_SUBMISSION_READY"
  | "QUEUE_SUBMISSION_BLOCKED"
  | "SHADOW_QUEUE_RECEIVED"
  | "RUNTIME_PLAN_READY"
  | "RUNTIME_PLAN_BLOCKED"
  | "WAITING_RUNTIME_RELEASE"
  | "RUNTIME_RELEASE_APPROVED"
  | "RUNTIME_RELEASE_REJECTED"
  | "RUNTIME_RELEASE_CHANGES_REQUESTED"
  | "SYSTEM_READY"
  | "SYSTEM_BLOCKED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type MissionType =
  | "resume_production"
  | "website_improvement"
  | "seo_campaign"
  | "marketing"
  | "publisher_ops"
  | "finance"
  | "support"
  | "multi_department"
  | "general";

export type MissionDependencyKind =
  | "sequential"
  | "parallel"
  | "prerequisite"
  | "blocking";

export type MissionDependencyEdge = {
  id: string;
  from: DepartmentId;
  to: DepartmentId;
  kind: MissionDependencyKind;
  description: string;
};

export type MissionDependencyGraph = {
  nodes: DepartmentId[];
  edges: MissionDependencyEdge[];
  critical_path: DepartmentId[];
  parallel_groups: DepartmentId[][];
  blocking_departments: DepartmentId[];
  notes: string[];
};

export type MissionSuccessKpi = {
  id: string;
  label: string;
  target: string;
  unit?: string;
  required: boolean;
};

export type MissionContract = {
  schema_version: typeof MISSION_SCHEMA_VERSION;
  mission_id: string;
  mission_version: number;
  mission_name: string;
  mission_type: MissionType;
  founder_objective: string;
  mission_description: string;
  business_goal: string;
  priority: PlanPriority;
  status: MissionLifecycleStatus;
  created_at: string;
  updated_at: string;
  owner: "founder" | "company_brain";
  founder_approval_required: true;
  /** Always false in V1 */
  execution_allowed: false;
  /** Always false in V1 */
  queue_admission_allowed: false;
  /** Always false in V1 */
  publishing_allowed: false;
  learning_enabled: true;
  risk_level: PlanRiskLevel;
  estimated_duration: string;
  estimated_departments: DepartmentPlanRole[];
  mission_tags: string[];
  success_kpis: MissionSuccessKpi[];
  current_stage: MissionLifecycleStatus;
  dependency_graph: MissionDependencyGraph;
  linked_plan_id: string | null;
  canonical_engine: "core.first-production-cycle";
  blocking_issues: PlanBlocker[];
  planning_notes: string[];
  supersedes_mission_id: string | null;
  fixture?: boolean;
};

export type MissionRegistryIndex = {
  schema_version: "mission-registry-1.0.0";
  updated_at: string;
  current_mission_id: string | null;
  mission_count: number;
  missions: Array<{
    mission_id: string;
    mission_version: number;
    mission_name: string;
    status: MissionLifecycleStatus;
    priority: PlanPriority;
    updated_at: string;
    path: string;
  }>;
};

export type MissionValidationIssue = {
  id: string;
  severity: "error" | "warning";
  code: string;
  message: string;
  field?: string;
};

export type MissionValidationResult = {
  ok: boolean;
  errors: MissionValidationIssue[];
  warnings: MissionValidationIssue[];
};

export type MissionCreateInput = {
  founder_objective: string;
  mission_name?: string;
  fixture?: boolean;
  /** Force WAITING_FOUNDER when awaiting approval presentation */
  await_founder?: boolean;
};

export type MissionCreateResult = {
  overall: "PASS" | "FAIL";
  mission: MissionContract;
  plan_id: string | null;
  validation: MissionValidationResult;
  artifact_paths: string[];
};
