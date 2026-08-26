export type ApprovalFsmState =
  | "pending"
  | "approved"
  | "rejected"
  | "pm_resume"
  | "completed"
  | "closed"
  | "deferred";

export type CommanderCommandType =
  | "APPROVE"
  | "REJECT"
  | "DEFER"
  | "ESTOP"
  | "PRIORITY"
  | "CANCEL"
  | "DELEGATE";

export type ParsedCommanderDecision = {
  command: CommanderCommandType;
  option_key?: string;
  notes?: string;
  defer_hours?: number;
  priority_level?: "P0" | "P1" | "P2" | "P3";
  delegate_target?: string;
  raw: string;
};

export type InboxMessage = {
  approval_id: string;
  correlation_id?: string;
  command: string;
  option?: string;
  notes?: string;
  timestamp?: string;
};

export type ApprovalRecord = {
  approval_id: string;
  correlation_id: string;
  task_id: string;
  state: ApprovalFsmState;
  command?: string;
  option?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  received_at?: string;
  pm_resume_at?: string;
  completed_at?: string;
  closed_at?: string;
  raw_command?: string;
  parse_error?: string;
  priority_override?: string;
  delegate_target?: string;
  estop?: boolean;
};

export type ApprovalsRuntimeState = {
  version: string;
  started_at: string;
  updated_at: string;
  processed_inbox_files: string[];
  processed_telegram_update_ids: number[];
  estop_active: boolean;
  last_processed_at: string | null;
};

export type ApprovalsStatus = {
  listener_state: "idle" | "listening" | "processing";
  uptime_seconds: number;
  last_heartbeat: string;
  started_at: string;
  pending_records: number;
  estop_active: boolean;
  current_approval_id: string | null;
  last_processed_at: string | null;
};

export type ProcessResult = {
  ok: boolean;
  approval_id: string;
  record_state: ApprovalFsmState;
  pm_resumed: boolean;
  error?: string;
};
