export type TelegramOutboundRecord = {
  approval_id: string;
  event_id: string;
  chat_id: string;
  message_id: number;
  sent_at: string;
  text_preview: string;
};

export type TelegramInboundMessage = {
  update_id: number;
  message_id: number;
  chat_id: string;
  user_id?: number;
  username?: string;
  text: string;
  reply_to_message_id?: number;
  hint_approval_id?: string;
  received_at: string;
};

export type TelegramPollState = {
  last_update_id: number;
  updated_at: string;
};

export type TelegramInboundLogMessage =
  | "reply_received"
  | "reply_parsed"
  | "approval_matched"
  | "approval_accepted"
  | "approval_rejected"
  | "duplicate_ignored"
  | "unauthorized_chat"
  | "unauthorized_user"
  | "parse_failed"
  | "match_failed"
  | "approval_expired"
  | "resume_started"
  | "resume_completed"
  | "telegram_message_updated"
  | "poll_error"
  | "poll_batch"
  | "poll_conflict_recovery"
  | "backlog_drain_error"
  | "backlog_drain_batch"
  | "backlog_drain_complete"
  | "inbox_ai_handled";
