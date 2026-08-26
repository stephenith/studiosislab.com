/**
 * SAIOS Telegram integration — types
 */

import type { IsoTimestamp, JobId, PlanId, Priority } from "../shared/types.js";
import type { FounderCommand } from "../chief/types.js";
import type { SaiosJob } from "../queue/types.js";

export type ParsedFounderCommand = {
  founder_command: FounderCommand;
  goal: string;
  priority: Priority;
  context: string;
  attachments: string[];
  intent: "execute" | "status" | "cancel" | "list_running";
  target_job_id?: JobId;
};

export type TelegramInboundLike = {
  update_id: number;
  message_id: number;
  chat_id: string;
  user_id?: number;
  username?: string;
  text: string;
  received_at: string;
};

export type TelegramBridgeResult = {
  handled: boolean;
  reply: string;
  plan_id?: PlanId;
  job_ids?: JobId[];
  notifications_sent?: number;
};

export type FounderSessionRecord = {
  chat_id: string;
  user_id?: string;
  plans: Array<{
    plan_id: PlanId;
    job_ids: JobId[];
    goal: string;
    submitted_at: IsoTimestamp;
    notified: boolean;
  }>;
  updated_at: IsoTimestamp;
};

export type JobStatusSummary = {
  job_id: JobId;
  title: string;
  status: string;
  assigned_worker: string | null;
  report_path: string | null;
};

export type SubmitFounderCommandResult = {
  accepted: boolean;
  reply: string;
  plan_id?: PlanId;
  job_ids?: JobId[];
};

export type CompletionNotificationRecord = {
  plan_id: PlanId;
  chat_id: string;
  title: string;
  body: string;
  sent_at: IsoTimestamp;
  ok: boolean;
};

export interface TelegramAdapter {
  sendInboxReply(chatId: string, text: string): Promise<{ ok: boolean; error?: string }>;
  sendCompletionNotification(input: {
    correlation_id: string;
    title: string;
    body: string;
    chat_id: string;
    plan_id: PlanId;
    metadata?: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string }>;
  isConfigured(): boolean;
}
