import type { Priority } from "../types.js";

export type AgentRole = "pm" | "developer" | "qa";

export type TaskStatus =
  | "queued"
  | "assigned_developer"
  | "developer_working"
  | "awaiting_dev_report"
  | "reviewing_dev"
  | "assigned_qa"
  | "qa_working"
  | "awaiting_qa_report"
  | "reviewing_qa"
  | "awaiting_approval"
  | "paused"
  | "completed"
  | "blocked"
  | "cancelled";

export type BacklogSection = "blocked" | "in_progress" | "planned" | "future";

export type BacklogItem = {
  id: string;
  section: BacklogSection;
  sectionRef: string;
  title: string;
  description: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  completionPct: number;
  evidence: string[];
  needsVerification: boolean;
  dependencies: string[];
  blockers: string[];
  status: "actionable" | "in_progress" | "blocked" | "completed";
};

export type Task = {
  task_id: string;
  correlation_id: string;
  backlog_id: string;
  title: string;
  description: string;
  priority: Priority;
  backlog_priority: BacklogItem["priority"];
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  evidence: string[];
  developer_brief_path?: string;
  developer_report_path?: string;
  qa_brief_path?: string;
  qa_report_path?: string;
  approval_id?: string;
  requires_commander_approval: boolean;
  hard_gate_ids: string[];
  confidence: number;
  qa_required: boolean;
  blocked_reason?: string;
  metadata?: Record<string, unknown>;
};

export type AgentAssignment = {
  agent: AgentRole;
  task_id: string;
  correlation_id: string;
  assigned_at: string;
  brief_path: string;
  status: "assigned" | "working" | "complete" | "failed";
};

export type WaitingApproval = {
  approval_id: string;
  task_id: string;
  correlation_id: string;
  created_at: string;
  expires_at: string;
  ccp_message_id: string;
  event_id: string;
  resume_stage: "pre_dev" | "post_dev" | "post_qa";
};

export type DecisionRecord = {
  timestamp: string;
  task_id: string;
  correlation_id: string;
  approval_id?: string;
  decision: string;
  command?: string;
  option_key?: string;
  cde_confidence?: number;
  commander_required: boolean;
  notes?: string;
};

export type PmState = {
  version: "1.0.0";
  started_at: string;
  updated_at: string;
  loop_status: "idle" | "running" | "paused" | "waiting_approval" | "stopped";
  current_task_id: string | null;
  developer_assignment: AgentAssignment | null;
  qa_assignment: AgentAssignment | null;
  waiting_approvals: WaitingApproval[];
  completed_task_ids: string[];
  blocked_task_ids: string[];
  task_queue: Task[];
  interruption_budget: {
    date: string;
    approvals_sent: number;
    blockers_sent: number;
    p0_sent: number;
    total_sent: number;
  };
  notified_backlog_ids: string[];
  last_selection: {
    backlog_id: string | null;
    title: string | null;
    score: number | null;
    technical_score: number | null;
    founder_score: number | null;
    combined_score: number | null;
    tier: number | null;
    founder_category: string | null;
    launch_stage: string | null;
    reason: string | null;
    skipped: Array<{ backlog_id: string; title: string; tier: number; why_skipped: string }>;
    remaining_by_tier: {
      tier_1: number;
      tier_2: number;
      tier_3: number;
      tier_4: number;
      tier_5: number;
    };
    at: string;
  } | null;
  roadmap?: RoadmapState;
  paused_tasks?: PausedTaskRecord[];
  reprioritization?: ReprioritizationSnapshot | null;
  notified_pause_ids?: string[];
  reprioritization_notifications?: ReprioritizationNotificationRecord[];
};

export type ReprioritizationNotificationRecord = {
  event_id: string;
  paused_task_id: string;
  paused_backlog_id: string;
  replacement_task_id: string;
  replacement_backlog_id: string;
  notified_at: string;
  telegram_sent: boolean;
};

export type ReprioritizationDecision = "continue" | "pause" | "archive" | "cancel" | "none";

export type PausedTaskRecord = {
  task_id: string;
  backlog_id: string;
  title: string;
  paused_at: string;
  reason: string;
  why_changed: string;
  founder_override: boolean;
  active_founder_category: string;
  active_founder_score: number;
  active_combined_score: number;
  replacement_backlog_id: string | null;
  replacement_task_id: string | null;
  replacement_title: string | null;
  archived_brief_path: string | null;
  preserved_artifacts: {
    work_plan_path: string | null;
    implementation_plan_path: string | null;
    execution_report_path: string | null;
    developer_brief_path: string | null;
  };
  decision: "pause";
  can_resume: boolean;
  reprioritization_event_id?: string;
};

export type ReprioritizationSnapshot = {
  last_cycle_at: string;
  decision: ReprioritizationDecision;
  founder_override: boolean;
  current_task_id: string | null;
  current_task_title: string | null;
  highest_backlog_id: string | null;
  highest_task_title: string | null;
  replacement_task_id: string | null;
  reason: string | null;
  why_changed: string | null;
};

export type DeveloperReport = {
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
};

export type QaReport = {
  task_id: string;
  correlation_id: string;
  completed_at: string;
  verdict: "pass" | "fail" | "blocked";
  summary: string;
  repro_steps?: string[];
  severity?: "critical" | "high" | "medium" | "low";
  evidence: string[];
  recommended_fixes?: string[];
  failed_checks?: string[];
  recommendation?: string;
};

export type RoadmapSliceStatus =
  | "planned"
  | "blocked_deps"
  | "queued"
  | "in_progress"
  | "completed"
  | "cancelled";

export type RoadmapSliceKind =
  | "implementation"
  | "qa"
  | "regression"
  | "follow_up"
  | "cleanup";

export type RoadmapComplexity = "small" | "medium" | "large";

export type RoadmapSlice = {
  slice_id: string;
  task_id: string | null;
  parent_task: string;
  parent_title: string;
  title: string;
  description: string;
  dependency: string[];
  estimated_complexity: RoadmapComplexity;
  acceptance_criteria: string[];
  evidence_paths: string[];
  suggested_files: string[];
  qa_checklist: string[];
  status: RoadmapSliceStatus;
  kind: RoadmapSliceKind;
  priority: BacklogItem["priority"];
  milestone: string;
  feature: string;
  created_at: string;
  completed_at?: string;
};

export type RoadmapEpic = {
  epic_id: string;
  title: string;
  milestone: string;
  feature: string;
  decomposed: boolean;
  slice_ids: string[];
  decomposed_at?: string;
};

export type RoadmapState = {
  version: "1.0.0";
  updated_at: string;
  epics: RoadmapEpic[];
  slices: RoadmapSlice[];
  known_slice_ids: string[];
};

export type RoadmapStatusSnapshot = {
  roadmap_completion_pct: number;
  current_milestone: string;
  current_feature: string;
  tasks_remaining: number;
  slices_total: number;
  slices_completed: number;
  slices_queued: number;
  slices_blocked_deps: number;
  estimated_days_to_launch: number;
  developer_utilization: "idle" | "assigned" | "working";
  qa_utilization: "idle" | "assigned" | "working";
  epics_decomposed: number;
  launch_criteria_met: number;
  launch_criteria_total: number;
};
