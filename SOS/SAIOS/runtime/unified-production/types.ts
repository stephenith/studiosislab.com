/**
 * Unified Resume Production Engine — type definitions.
 */

export const UNIFIED_STAGES = [
  "queued",
  "researching",
  "benchmarking",
  "designing",
  "composing",
  "generating",
  "qa",
  "render_review",
  "founder_critic",
  "publication_ready",
  "waiting_founder",
] as const;

export type UnifiedStage = (typeof UNIFIED_STAGES)[number];

export type TerminalState =
  | "approved"
  | "rejected"
  | "revision"
  | "published"
  | "archived";

export type UnifiedRunStatus =
  | "running"
  | "waiting_founder"
  | "completed"
  | "failed"
  | "cancelled"
  | TerminalState;

export type StageTiming = {
  stage: UnifiedStage;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  pass: boolean;
  retry_count: number;
};

export type StageArtifact = {
  stage: UnifiedStage;
  component: string;
  path: string;
  files: string[];
};

export type UnifiedRunState = {
  run_id: string;
  run_dir: string;
  objective: string;
  created_at: string;
  updated_at: string;
  current_stage: UnifiedStage | TerminalState | "failed" | "cancelled";
  completed_stages: UnifiedStage[];
  failed_stage: UnifiedStage | null;
  status: UnifiedRunStatus;
  retry_count: number;
  max_retries: number;
  stage_timings: StageTiming[];
  artifacts: StageArtifact[];
  prototype_id: string | null;
  prototype_dir: string | null;
  composition_id: string | null;
  catalog_id: string | null;
  error: string | null;
  cancelled: boolean;
  quality: QualitySummary | null;
};

export type QualitySummary = {
  premium_score: number;
  ats_score: number;
  visual_render_score: number;
  recruiter_score: number;
  overall_confidence: number;
  founder_prediction: string;
  publication_ready: boolean;
  publication_blocked: boolean;
};

export type UnifiedProductionOptions = {
  objective: string;
  run_id?: string;
  mcp_firecrawl_available?: boolean;
  learning_persist?: boolean;
  seed?: number;
  resume_run_id?: string;
  start_from_stage?: UnifiedStage;
};

export type UnifiedProductionResult = {
  pass: boolean;
  run_id: string;
  run_dir: string;
  status: UnifiedRunStatus;
  awaiting_founder: boolean;
  state: UnifiedRunState;
  master_report_path: string;
  dashboard_path: string;
  artifact_index_path: string;
};

export type MasterProductionReport = {
  run_id: string;
  objective: string;
  generated_at: string;
  status: UnifiedRunStatus;
  stage_timings: StageTiming[];
  quality: QualitySummary | null;
  founder_prediction: string;
  publication_readiness: string;
  learning_updates: string[];
  artifacts_by_stage: Record<string, string[]>;
  gates: {
    all_stages_executed: boolean;
    all_artifacts_present: boolean;
    quality_gates_passed: boolean;
    founder_gate_enforced: boolean;
    publication_never_automatic: boolean;
  };
};

export type ProductionDashboard = {
  updated_at: string;
  current_run_id: string | null;
  current_stage: string;
  completed_stages: string[];
  failed_stages: string[];
  retry_count: number;
  estimated_completion_pct: number;
  average_stage_duration_ms: number;
  overall_health: "healthy" | "degraded" | "failed";
  active_runs: number;
  waiting_founder: number;
};
