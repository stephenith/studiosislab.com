/**
 * Production Controller — shared types.
 */

export const PRODUCT_TYPES = [
  "resume",
  "cover_letter",
  "invoice",
  "portfolio",
  "template_library",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const COMMAND_INTENTS = [
  "generate",
  "improve",
  "analyze",
  "create_collection",
] as const;

export type CommandIntent = (typeof COMMAND_INTENTS)[number];

export type InterpretedCommand = {
  raw_objective: string;
  intent: CommandIntent;
  product_type: ProductType;
  count: number;
  priority: string;
  industry: string | null;
  keywords: string[];
  requires_research: boolean;
  supported: boolean;
  unsupported_reason?: string;
};

export type WorkerAssignment = {
  worker_type: string;
  role: string;
  count: number;
};

export type ObjectivePlan = {
  plan_id: string;
  objective: string;
  command: InterpretedCommand;
  needs_research: boolean;
  workers: WorkerAssignment[];
  job_count: number;
  batch_size: number;
  priority: string;
  use_queue: boolean;
  use_batch_director: boolean;
  pipeline_stages: string[];
  research_topics: string[];
  estimated_duration_ms: number;
};

export type SessionPhase =
  | "interpreted"
  | "planned"
  | "researching"
  | "queued"
  | "pipeline"
  | "qa"
  | "review"
  | "approval"
  | "learning"
  | "completed"
  | "failed";

export type ProductionSessionRecord = {
  session_id: string;
  session_dir: string;
  objective: string;
  command: InterpretedCommand;
  plan: ObjectivePlan;
  phase: SessionPhase;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  research_session_id: string | null;
  research_dir: string | null;
  pipeline_run_id: string | null;
  pipeline_dir: string | null;
  jobs_total: number;
  jobs_completed: number;
  qa_pass: boolean | null;
  founder_decision: string | null;
  learning_applied: boolean;
  templates_generated: number;
  confidence: number | null;
  final_report_path: string | null;
  pass: boolean;
  error: string | null;
};

export type DashboardMetrics = {
  generated_at: string;
  active_session: string | null;
  completed_sessions: number;
  templates_generated: number;
  approval_rate: number;
  average_confidence: number;
  learning_growth: number;
  top_industries: Array<{ industry: string; count: number }>;
  most_successful_layouts: Array<{ layout: string; count: number }>;
  worker_performance: Array<{ worker: string; jobs: number; success_rate: number }>;
  cursor_usage: number;
};

export type ControllerRunResult = {
  pass: boolean;
  session: ProductionSessionRecord;
  dashboard: DashboardMetrics;
};
