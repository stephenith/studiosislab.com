/**
 * Founder Operations Dashboard — type definitions.
 */

export type FactoryStatus = "running" | "paused" | "stopped" | "emergency_stop";

export type FounderDashboardSnapshot = {
  generated_at: string;
  factory_status: FactoryStatus;
  scheduler_status: string;
  production_status: string;
  current_stage: string | null;
  current_objective: string | null;
  current_worker: string | null;
  queue_size: number;
  production_rate_per_hour: number;
  estimated_completion_pct: number;
  health: "healthy" | "degraded" | "critical";
};

export type ReviewItem = {
  run_id: string;
  prototype_id: string;
  template_path: string;
  objective: string;
  quality_score: number;
  founder_prediction: string;
  ats_score: number;
  premium_score: number;
  visual_score: number;
  publication_status: string;
  review_command: string | null;
  catalog_id: string | null;
};

export type CategoryCoverageRow = {
  category: string;
  published: number;
  draft: number;
  queued: number;
  missing: number;
  target_count: number;
};

export type DashboardBuildResult = {
  pass: boolean;
  output_dir: string;
  artifacts: string[];
  snapshot: FounderDashboardSnapshot;
};

export type FounderDashboardOptions = {
  persist?: boolean;
  search_query?: string;
};

export type FounderAction = "approve" | "reject" | "revision" | "skip";

export type FounderReviewAction = {
  prototype_id: string;
  action: FounderAction;
  founder_name?: string;
  note?: string;
};

export type ExportFormat = "json" | "csv" | "pdf";
