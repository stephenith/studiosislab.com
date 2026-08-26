/**
 * Execution Package & Dry-Run Preview V1 — types (Agent #165).
 * Preview only. Never enqueues, executes, dispatches, or publishes.
 */

import type { PlanPriority, PlanRiskLevel } from "./types.js";

export const EXECUTION_PACKAGE_SCHEMA_VERSION =
  "execution-package-1.0.0" as const;

export type ExecutionStageId =
  | "mission"
  | "knowledge"
  | "planning"
  | "designbrief"
  | "renderer"
  | "editor_compatibility"
  | "critic"
  | "gate"
  | "founder_review"
  | "learning";

export type ExecutionGraphNode = {
  id: ExecutionStageId;
  label: string;
  order: number;
  description: string;
  executed: false;
};

export type ExecutionGraphEdge = {
  from: ExecutionStageId;
  to: ExecutionStageId;
  kind: "sequential";
};

export type ExecutionGraph = {
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
  critical_path: ExecutionStageId[];
  note: string;
};

export type WorkerGraphNodeKind =
  | "director"
  | "manager"
  | "worker"
  | "skill"
  | "model"
  | "tool";

export type WorkerGraphNode = {
  id: string;
  kind: WorkerGraphNodeKind;
  label: string;
  informational: true;
};

export type WorkerGraphEdge = {
  from: string;
  to: string;
  kind: "orchestrates" | "uses" | "invokes";
};

export type WorkerGraph = {
  nodes: WorkerGraphNode[];
  edges: WorkerGraphEdge[];
  note: string;
};

export type QualityGateId =
  | "knowledge_ready"
  | "mission_approved"
  | "queue_approved"
  | "design_ready"
  | "render_ready"
  | "critic_ready"
  | "founder_review"
  | "learning_complete"
  | "publishing_eligible";

export type QualityGate = {
  id: QualityGateId;
  label: string;
  required: boolean;
  satisfied: boolean | null;
  publishing_gate: boolean;
  note: string;
};

export type RollbackPoint = {
  id: string;
  after_stage: ExecutionStageId;
  label: string;
  description: string;
  implemented: false;
};

export type DependencyGraphPreview = {
  nodes: string[];
  edges: Array<{ from: string; to: string; kind: string }>;
  critical_path: string[];
};

export type ExecutionPackage = {
  schema_version: typeof EXECUTION_PACKAGE_SCHEMA_VERSION;
  package_id: string;
  execution_id: string;
  mission_id: string;
  mission_version: number;
  plan_id: string | null;
  department: string;
  priority: PlanPriority;
  objective: string;
  required_departments: string[];
  required_workers: string[];
  required_skills: string[];
  required_models: string[];
  required_tools: string[];
  knowledge_snapshot_reference: string | null;
  estimated_duration: string;
  estimated_cost_usd: number | null;
  estimated_cost_note: string;
  estimated_outputs: string[];
  dependency_graph: DependencyGraphPreview;
  worker_graph: WorkerGraph;
  execution_graph: ExecutionGraph;
  rollback_points: RollbackPoint[];
  quality_gates: QualityGate[];
  founder_checkpoints: string[];
  risk_summary: {
    risk_level: PlanRiskLevel;
    risks: string[];
    warnings: string[];
  };
  publish_policy: {
    publishing_allowed: false;
    publishing_eligible: false;
    note: string;
  };
  canonical_engine: "core.first-production-cycle";
  /** Immutable package version for acknowledgement */
  package_version: number;
  /** SHA-256 of canonical package body (excludes checksum field) */
  checksum: string;
  dry_run: true;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  created_at: string;
  created_by: "company_brain";
  next_safe_action: string;
  execution_still_blocked_reason: string;
  fixture?: boolean;
};

export type ExecutionPackageEvent = {
  event_id: string;
  event_type: "PACKAGE_BUILT" | "PACKAGE_VALIDATED" | "PACKAGE_REJECTED";
  at: string;
  mission_id: string;
  package_id: string | null;
  summary: string;
  fixture?: boolean;
};

export type ExecutionPackageSnapshot = {
  schema_version: "execution-package-snapshot-1.0.0";
  updated_at: string;
  latest_package_id: string | null;
  mission_id: string | null;
  execution_id: string | null;
  dry_run: true;
  execution_allowed: false;
  queue_enqueue_allowed: false;
  publishing_allowed: false;
  package_count: number;
};

export type ExecutionPackageBuildResult = {
  ok: boolean;
  package: ExecutionPackage | null;
  error?: string;
  error_code?: string;
  artifact_paths: string[];
};
