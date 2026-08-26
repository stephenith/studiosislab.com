/**
 * Production Dashboard — shared types.
 * AGENT #096 — orchestration / visibility only.
 */

export type QueueStage =
  | "draft"
  | "generated"
  | "qa_complete"
  | "founder_review"
  | "ready_to_publish"
  | "published"
  | "archived"
  | "rolled_back";

export type TemplateLifecycleRecord = {
  prototype_id: string;
  catalog_id: string | null;
  role: string | null;
  industry: string | null;
  batch_id: string | null;
  current_stage: QueueStage;
  generation_status: string;
  qa_status: string;
  visual_render_status: string;
  founder_critic_status: string;
  competitive_validation_status: string;
  publication_status: string;
  release_status: string;
  rollback_status: string;
  release_id: string | null;
  founder_approval: string;
  latest_review: string | null;
  latest_calibration: string;
  latest_design_dna: string;
  scores: {
    premium: number | null;
    ats: number | null;
    render: number | null;
    competitive: number | null;
    confidence: number | null;
    overall: number | null;
  };
  paths: {
    generated_dir: string | null;
    package_dir: string | null;
    qa_validation: string | null;
  };
  freshness: {
    stale: boolean;
    reasons: string[];
  };
  issues: string[];
  searchable: Record<string, string | null>;
};

export type BatchHealth = {
  batch_id: string;
  template_count: number;
  overall_completion_pct: number;
  qa_pct: number;
  publication_pct: number;
  founder_approval_pct: number;
  averages: {
    premium_score: number | null;
    ats_score: number | null;
    render_score: number | null;
    competitive_score: number | null;
    confidence: number | null;
  };
};

export type FactoryHealth = {
  status: "healthy" | "attention_required" | "degraded";
  templates_generated: number;
  templates_published: number;
  templates_waiting_founder: number;
  templates_ready_to_publish: number;
  templates_failed_qa: number;
  templates_released: number;
  templates_rolled_back: number;
  templates_under_review: number;
  current_batch: string;
  current_queue_size: number;
  current_release: string;
  current_factory_version: string;
  issues_detected: number;
  stale_templates: number;
};

export type ProductionDashboard = {
  generated_at: string;
  factory_health: FactoryHealth;
  batch_health: BatchHealth;
  queue: TemplateLifecycleRecord[];
  publication_status: Array<{
    catalog_id: string;
    prototype_id: string;
    publication_state: string;
    live: boolean;
    package_exists: boolean;
    release_id: string | null;
  }>;
  issues: string[];
  search_index: Array<{
    key: string;
    prototype_id: string;
    catalog_id: string | null;
    stage: QueueStage;
  }>;
};
