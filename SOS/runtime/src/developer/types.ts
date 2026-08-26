export type DeveloperState =
  | "idle"
  | "paused"
  | "working"
  | "prepared"
  | "executing"
  | "awaiting_qa"
  | "new_brief"
  | "claimed"
  | "planning"
  | "waiting_review"
  | "completed"
  | "blocked";

export type ParsedBrief = {
  task_id: string;
  correlation_id: string;
  backlog_id: string;
  priority: string;
  title: string;
  description: string;
  objective: string;
  evidence: string[];
  acceptance_criteria: string[];
  hard_gate_ids: string[];
  qa_checklist: string[];
  pm_recommendation: string;
  report_path: string;
  brief_path: string;
  claimed: boolean;
  /** Canonical founder command — metadata.founder_instruction carried in brief. */
  founder_instruction?: string;
};

export type WorkPlan = {
  work_plan_id: string;
  task_id: string;
  correlation_id: string;
  created_at: string;
  objective: string;
  title: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  hard_gates: string[];
  pm_recommendation: string;
  risks: string[];
  unknowns: string[];
};

export type ImplementationPlan = {
  implementation_plan_id: string;
  task_id: string;
  correlation_id: string;
  created_at: string;
  status: "pending_execution";
  objective: string;
  phases: Array<{
    phase: number;
    name: string;
    steps: string[];
    files: string[];
  }>;
  validation: string[];
  out_of_scope: string[];
};

export type ExecutionReportPlaceholder = {
  task_id: string;
  correlation_id: string;
  status: "pending";
  created_at: string;
  summary: string | null;
  files_changed: string[];
  build_passed: boolean | null;
  confidence: number | null;
  blocker: boolean;
  blocker_reason: string | null;
  evidence: string[];
  needs_qa: boolean | null;
  note: string;
};

export type ExecutionReport = {
  task_id: string;
  correlation_id: string;
  status: "pending" | "completed" | "failed" | "blocked";
  created_at: string;
  completed_at: string;
  implementation_summary: string;
  diff_summary: string;
  files_changed: string[];
  validation: {
    build: { passed: boolean; duration_ms: number; output: string };
    lint: { passed: boolean; duration_ms: number; output: string };
    test: {
      passed: boolean;
      duration_ms: number;
      output: string;
      skipped?: boolean;
      reason?: string;
    };
    execution_duration_ms: number;
    warnings: string[];
    failures: string[];
  };
  blockers: string[];
  recommendations: string[];
  ready_for_qa: boolean;
  confidence: number;
};

export type ExecutionPlan = {
  plan_id: string;
  task_id: string;
  correlation_id: string;
  created_at: string;
  objective: string;
  files_involved: string[];
  risk: string;
  estimated_complexity: "low" | "medium" | "high";
  acceptance_criteria: string[];
  unknowns: string[];
  steps: string[];
};

export type ProgressMilestone =
  | "planning_complete"
  | "execution_started"
  | "progress_50"
  | "needs_clarification"
  | "blocked"
  | "execution_complete";

export type ProgressReport = {
  report_id: string;
  task_id: string;
  correlation_id: string;
  milestone: ProgressMilestone;
  timestamp: string;
  message: string;
  percent_complete?: number;
  metadata?: Record<string, unknown>;
};

export type ExecutionResult = {
  success: boolean;
  summary: string;
  files_changed: string[];
  build_passed: boolean;
  confidence: number;
  blocker: boolean;
  blocker_reason?: string;
  needs_qa: boolean;
  qa_checklist: string[];
  estimated_regression_risk: "low" | "medium" | "high";
  evidence: string[];
  artifacts_path?: string;
};

export type DeveloperRuntimeState = {
  version: "1.0.0";
  state: DeveloperState;
  started_at: string;
  updated_at: string;
  current_task_id: string | null;
  current_correlation_id: string | null;
  claimed_brief_path: string | null;
  processed_brief_ids: string[];
  handed_off_task_ids: string[];
  completed_task_ids: string[];
  blocked_task_ids: string[];
  work_plan_path: string | null;
  implementation_plan_path: string | null;
  execution_report_path: string | null;
  execution_submitted: boolean;
};

export type DeveloperStatus = {
  state: DeveloperState;
  current_task_id: string | null;
  current_correlation_id: string | null;
  uptime_seconds: number;
  last_heartbeat: string;
  started_at: string;
};

export type TaskLock = {
  task_id: string;
  correlation_id: string;
  pid: number;
  claimed_at: string;
  brief_path: string;
};
