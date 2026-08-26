/**
 * Founder Command Center client types — Agent #222A.
 * Mirrors buildFounderCommandCenterSnapshot() (read-only).
 */

export type FreshnessStatus =
  | "current"
  | "stale"
  | "missing"
  | "unavailable";

export type FreshnessMeta = {
  status: FreshnessStatus;
  source_path: string | null;
  generated_at: string | null;
  age_minutes: number | null;
  detail: string;
};

export type FccSection<T> = {
  freshness: FreshnessMeta;
  data: T | null;
};

export type FounderCommandCenterSnapshot = {
  schema_version: 1;
  agent: "222A";
  generated_at: string;
  read_only: true;
  advisory_only: true;
  mutations: false;
  production_triggered: false;
  openai_called: false;
  safety: {
    live: false;
    live_label: "LIVE OFF";
    publication_allowed: false;
    publication_label: "Publication Disabled";
    founder_approval_required: true;
    production_entry: "ProductionController";
    runtime_guard_present: boolean;
    runtime_guard_detail: string;
  };
  factory: FccSection<{
    autonomous_state: string | null;
    autonomous_running: boolean | null;
    session_id: string | null;
  }>;
  autonomous: FccSection<{
    state: string | null;
    running: boolean | null;
    busy: boolean | null;
    iterations: number | null;
    interval_ms: number | null;
    adaptive_scheduling_enabled: boolean | null;
    scheduling_decision: string | null;
    next_interval_ms: number | null;
    next_evaluation_at: string | null;
    last_execution_id: string | null;
  }>;
  health: FccSection<{
    status: string | null;
    failed_checks: string[];
    queue_waiting: number | null;
    queue_max: number | null;
  }>;
  budget: FccSection<{
    decision: string | null;
    violation_codes: string[];
    daily_cycles: number | null;
    daily_candidates: number | null;
  }>;
  scheduling: FccSection<{
    decision: string | null;
    next_interval_ms: number | null;
    reason_codes: string[];
    cooldown_active: boolean | null;
  }>;
  operations: FccSection<{
    today_cycles: number | null;
    today_candidates: number | null;
    portfolio_score: number | null;
    strategy_version: number | null;
    founder_queue_waiting: number | null;
  }>;
  founder_queue: FccSection<{
    waiting_founder: number;
    total_candidates: number;
    by_status: Record<string, number>;
  }>;
  portfolio: FccSection<{
    coverage_score: number | null;
    candidate_total: number | null;
    recommendation_count: number | null;
  }>;
  strategy: FccSection<{
    strategy_version: number | null;
    recommendation_count: number | null;
    portfolio_score: number | null;
  }>;
  advisor: FccSection<{
    recommendation_count: number | null;
    top_ids: string[];
  }>;
  engineering: FccSection<{
    overall: number | null;
    scores: Record<string, number> | null;
    open_count: number | null;
    severity_summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    } | null;
    generated_at: string | null;
  }>;
  last_execution: FccSection<{
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    health_status: string | null;
    budget_decision: string | null;
    candidate_count: number | null;
  }>;
  last_failure: FccSection<{
    execution_id: string | null;
    stop_reason: string | null;
    finished_at: string | null;
    stop_detail: string | null;
  }>;
  reports_index: Array<{
    id: string;
    label: string;
    path: string;
    available: boolean;
  }>;
  legacy: {
    founder_control_center: "Legacy (Non-Canonical)";
    founder_dashboard_runtime: "Legacy (Non-Canonical)";
    react_founder_review: "Canonical";
  };
  duration_ms: number;
};
