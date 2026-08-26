/**
 * Autonomous Resume Factory Scheduler — type definitions.
 */

export type ScheduleFrequency =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "manual"
  | "cron";

export type ProductionCategory =
  | "ats"
  | "executive"
  | "creative"
  | "student"
  | "healthcare"
  | "marketing"
  | "finance"
  | "engineering"
  | "resume_refresh"
  | "seo_expansion";

export type ProductionGoal = {
  id: string;
  name: string;
  category: ProductionCategory;
  enabled: boolean;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  objective_template: string;
  priority: "P0" | "P1" | "P2" | "P3";
  max_per_run: number;
};

export type WorkloadLimits = {
  max_resumes_per_hour: number;
  max_resumes_per_day: number;
  max_concurrent_runs: number;
  max_retry_count: number;
  sleep_interval_ms: number;
  min_disk_space_mb: number;
};

export type ServerMode = {
  headless: boolean;
  persistent: boolean;
  auto_restart: boolean;
  platform: "vps" | "mac" | "windows" | "linux" | "auto";
};

export type SchedulerConfig = {
  version: string;
  updated_at: string;
  enabled: boolean;
  server_mode: ServerMode;
  workload: WorkloadLimits;
  goals: ProductionGoal[];
  founder_rules: {
    never_publish_automatically: true;
    never_bypass_founder_approval: true;
    never_modify_src: true;
    never_modify_production_artifacts: true;
  };
};

export type SchedulerRunState = {
  scheduler_id: string;
  started_at: string;
  updated_at: string;
  status: "running" | "paused" | "stopped" | "interrupted";
  last_tick_at: string | null;
  jobs_created_today: number;
  jobs_completed_today: number;
  jobs_failed_today: number;
  resumes_this_hour: number;
  hour_window_start: string;
  day_window_start: string;
  active_run_ids: string[];
  interrupted_at: string | null;
  last_goal_runs: Record<string, string>;
};

export type SchedulerJobRecord = {
  job_id: string;
  goal_id: string;
  category: ProductionCategory;
  objective: string;
  unified_run_id: string | null;
  status: "queued" | "running" | "waiting_founder" | "completed" | "failed" | "cancelled" | "paused";
  created_at: string;
  updated_at: string;
  retry_count: number;
  awaiting_founder: boolean;
  error: string | null;
};

export type ProductionExecutorResult = {
  pass: boolean;
  run_id: string;
  status: string;
  awaiting_founder: boolean;
  publication_automatic: boolean;
};

export type ProductionExecutor = (input: {
  objective: string;
  category: ProductionCategory;
  job_id: string;
  seed?: number;
}) => Promise<ProductionExecutorResult>;

export type SchedulerOptions = {
  config?: Partial<SchedulerConfig>;
  production_executor?: ProductionExecutor;
  dry_run?: boolean;
  persist?: boolean;
};

export type SchedulerTickResult = {
  jobs_created: number;
  jobs_processed: number;
  jobs_waiting_founder: number;
  alerts: string[];
};

export type SchedulerStartResult = {
  pass: boolean;
  scheduler_id: string;
  status: string;
  config_path: string;
};
