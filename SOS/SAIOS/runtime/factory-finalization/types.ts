/**
 * Factory V1 Finalization — shared types.
 * AGENT #099 — documentation and operational freeze only.
 */

export type SubsystemStatus = {
  id: string;
  label: string;
  verify_command: string | null;
  module_path: string | null;
  status: "pass" | "fail" | "skipped" | "read_only_pass";
  note?: string;
};

export type ReadinessDimension = {
  id: string;
  label: string;
  score: number;
  max: number;
  status: "ready" | "attention" | "blocked";
  notes: string[];
};

export type ProductionReadiness = {
  generated_at: string;
  factory_version: string;
  factory_v1_status: "STABLE" | "UNSTABLE";
  feature_complete: boolean;
  production_ready: boolean;
  foundation_locked: boolean;
  readiness_score: number;
  readiness_max: 100;
  dimensions: ReadinessDimension[];
  subsystems: SubsystemStatus[];
  risks: string[];
  future_work: string[];
};

export type RuntimeDependencyNode = {
  id: string;
  label: string;
  type: "engine" | "orchestration" | "publication" | "platform";
  depends_on: string[];
  verify_command: string | null;
};

export type RuntimeDependencyGraph = {
  generated_at: string;
  version: string;
  nodes: RuntimeDependencyNode[];
  pipeline_order: string[];
};
