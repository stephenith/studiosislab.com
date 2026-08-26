/**
 * Resume Production Batch Director — shared types
 */

export const BATCH_SIZES = [10, 25, 50, 100] as const;
export type BatchSize = (typeof BATCH_SIZES)[number];

export const PRODUCTION_PRIORITIES = [
  "ats",
  "visual",
  "executive",
  "minimal",
  "creative",
  "healthcare",
  "engineering",
  "finance",
  "marketing",
  "sales",
  "hr",
  "student",
  "operations",
  "government",
  "academic",
  "hospitality",
] as const;

export type ProductionPriority = (typeof PRODUCTION_PRIORITIES)[number];

export type JobStatus =
  | "queued"
  | "assigned"
  | "cursor_research"
  | "worker_running"
  | "qa_running"
  | "awaiting_founder"
  | "completed"
  | "failed"
  | "revision_required";

export type ResumeJob = {
  job_id: string;
  batch_id: string;
  index: number;
  priority: ProductionPriority;
  tier: "ats_safe" | "visual";
  status: JobStatus;
  worker_id: string;
  template_slug: string;
  retry_count: number;
  cursor_session_id?: string;
  research_ms?: number;
  worker_ms?: number;
  qa_ms?: number;
  confidence?: number;
  qa_pass?: boolean;
  founder_approved?: boolean;
  error?: string;
  started_at?: string;
  completed_at?: string;
};

export type BatchPlan = {
  batch_id: string;
  created_at: string;
  requested_by: "founder";
  size: number;
  primary_priority: ProductionPriority;
  priorities_distribution: Record<ProductionPriority, number>;
  jobs: ResumeJob[];
  policies_version: string;
};

export type BatchMetrics = {
  batch_id: string;
  current_batch_size: number;
  completed: number;
  remaining: number;
  failed: number;
  active: number;
  success_rate: number;
  average_time_ms: number;
  cursor_failures: number;
  research_time_ms: number;
  qa_time_ms: number;
  approval_rate: number;
  learning_updates: number;
  eta_ms: number;
  queue_depth: number;
};

export type BatchSummary = {
  batch_id: string;
  title: string;
  completed: number;
  passed_qa: number;
  founder_approved: number;
  revision_required: number;
  failed: number;
  average_confidence: number;
  learning_rules_added: number;
  generated_at: string;
};

export type CursorResearchRequest = {
  job_id: string;
  priority: ProductionPriority;
  knowledge_sources: string[];
  mcp_firecrawl_available: boolean;
  research_topics: string[];
  temporary_only: true;
};

export type CursorResearchResult = {
  job_id: string;
  success: boolean;
  duration_ms: number;
  sources_consulted: string[];
  external_research: string[];
  intelligence_applied: string[];
  error?: string;
};

export type DirectorRunResult = {
  pass: boolean;
  batch_id: string;
  plan: BatchPlan;
  metrics: BatchMetrics;
  summary: BatchSummary;
  output_dir: string;
};
