/**
 * SAIOS Notifications module — types
 */

import type { IsoTimestamp } from "../shared/types.js";

export type NotificationChannel = "telegram" | "email" | "slack";

export type NotificationMessage = {
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  created_at: IsoTimestamp;
};

export type NotificationResult = {
  channel: NotificationChannel;
  ok: boolean;
  message_id?: string | number | null;
  error?: string | null;
};

export interface TelegramNotifier {
  send(message: Omit<NotificationMessage, "channel" | "created_at">): Promise<NotificationResult>;
}

export interface EmailNotifier {
  send(message: Omit<NotificationMessage, "channel" | "created_at">): Promise<NotificationResult>;
}

/** Placeholder for future Slack integration */
export interface SlackNotifier {
  send(message: Omit<NotificationMessage, "channel" | "created_at">): Promise<NotificationResult>;
}

export type NotificationService = {
  telegram: TelegramNotifier;
  email: EmailNotifier;
  slack: SlackNotifier;
};
