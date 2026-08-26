export type QaState =
  | "idle"
  | "waiting_brief"
  | "claimed"
  | "prepare_checklist"
  | "verification"
  | "pass"
  | "fail"
  | "blocked";

export type ParsedQaBrief = {
  task_id: string;
  correlation_id: string;
  priority: string;
  title: string;
  objective: string;
  brief_path: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  dev_report_path: string;
  pm_requirements: string;
  qa_checklist: string[];
  /** Canonical founder command — metadata.founder_instruction carried in brief. */
  founder_instruction?: string;
};

export type DeveloperReportInput = {
  task_id: string;
  correlation_id: string;
  completed_at: string;
  summary: string;
  files_changed: string[];
  build_passed: boolean;
  confidence: number;
  blocker: boolean;
  blocker_reason?: string;
  evidence: string[];
  needs_qa?: boolean;
  qa_checklist?: string[];
  estimated_regression_risk?: "low" | "medium" | "high";
  acceptance_criteria?: string[];
};

export type ChecklistItem = {
  id: string;
  description: string;
  source: "brief" | "developer" | "acceptance" | "risk";
  required: boolean;
};

export type ChecklistResult = {
  item_id: string;
  passed: boolean;
  notes: string;
};

export type VerificationResult = {
  verdict: "pass" | "fail" | "blocked";
  confidence: number;
  regression_risk: "low" | "medium" | "high";
  summary: string;
  recommendation: string;
  recommended_fixes: string[];
  remaining_blockers: string[];
  checklist_results: ChecklistResult[];
  evidence: string[];
  screenshots: string[];
  screenshot_supported: boolean;
  repro_steps?: string[];
  severity?: "critical" | "high" | "medium" | "low";
};

export type QaRuntimeState = {
  version: "1.0.0";
  state: QaState;
  started_at: string;
  updated_at: string;
  current_task_id: string | null;
  current_correlation_id: string | null;
  claimed_brief_path: string | null;
  completed_task_ids: string[];
  failed_task_ids: string[];
  processed_verification_keys: string[];
};

export type QaStatus = {
  state: QaState;
  current_task_id: string | null;
  current_correlation_id: string | null;
  uptime_seconds: number;
  last_heartbeat: string;
  started_at: string;
};

export type QaTaskLock = {
  task_id: string;
  correlation_id: string;
  pid: number;
  claimed_at: string;
  brief_path: string;
};

export type QaFullReport = {
  task_id: string;
  correlation_id: string;
  completed_at: string;
  verdict: "pass" | "fail" | "blocked";
  summary: string;
  confidence: number;
  regression_risk: "low" | "medium" | "high";
  recommended_fixes: string[];
  remaining_blockers: string[];
  checklist_results: ChecklistResult[];
  repro_steps?: string[];
  severity?: "critical" | "high" | "medium" | "low";
  evidence: string[];
  developer_summary?: string;
  recommendation?: string;
  screenshots?: string[];
  screenshot_supported?: boolean;
  failed_checks?: string[];
};

export type ProgressMilestone =
  | "checklist_prepared"
  | "verification_started"
  | "verification_complete"
  | "report_written";

export type QaProgressReport = {
  report_id: string;
  task_id: string;
  correlation_id: string;
  milestone: ProgressMilestone;
  timestamp: string;
  message: string;
  metadata?: Record<string, unknown>;
};
