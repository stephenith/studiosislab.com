export type InboxIntent =
  | "STATUS"
  | "NEXT_TASK"
  | "PAUSE_TASK"
  | "RESUME_TASK"
  | "CHANGE_PRIORITY"
  | "CREATE_TASK"
  | "EXECUTE_NOW"
  | "CREATE_EPIC"
  | "CREATE_ROADMAP"
  | "STOP_ALL"
  | "START_ALL"
  | "SHOW_QUEUE"
  | "SHOW_ROADMAP"
  | "SHOW_DEVELOPER"
  | "SHOW_QA"
  | "SHOW_PM"
  | "HELP"
  | "CONFIRM"
  | "UNKNOWN";

export type StructuredAction = {
  intent: InboxIntent;
  subject?: string | null;
  target?: string | null;
  before?: string | null;
  quantity?: number | null;
  destructive?: boolean;
  raw_text: string;
  confidence: number;
};

export type InboxCommandResult = {
  ok: boolean;
  intent: InboxIntent;
  action: StructuredAction;
  runtime_action: string;
  details?: Record<string, unknown>;
  error?: string | null;
};

export type InboxAiResponse = {
  handled: boolean;
  reply?: string;
  result?: InboxCommandResult;
};

export type ConversationState = {
  updated_at: string;
  last_intent: InboxIntent | null;
  last_subject: string | null;
  last_task_id: string | null;
  last_backlog_id: string | null;
  pending_confirmation: {
    action: string;
    intent: InboxIntent;
    payload: Record<string, unknown>;
    created_at: string;
  } | null;
};
