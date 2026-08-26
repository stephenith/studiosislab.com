/**
 * Channel adapter contract for Notification Department.
 */
import type { ChannelSendResult, NotificationChannel } from "./types.js";

export type OutboundMessage = {
  title: string;
  body: string;
  priority: string;
  type: string;
};

export interface NotificationChannelAdapter {
  channel: NotificationChannel;
  configured: boolean;
  send(message: OutboundMessage, options?: { dry_run?: boolean }): Promise<ChannelSendResult>;
}
