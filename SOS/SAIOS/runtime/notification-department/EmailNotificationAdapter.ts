/**
 * Email adapter — dry-run by default; mirrors SOS/runtime Resend email payload shape.
 */
import type { NotificationChannelAdapter, OutboundMessage } from "./NotificationChannelAdapter.js";
import type { ChannelSendResult } from "./types.js";
import { detectLiveCredentials } from "./NotificationConfig.js";

export class EmailNotificationAdapter implements NotificationChannelAdapter {
  readonly channel = "email" as const;
  readonly configured: boolean;

  constructor() {
    this.configured = detectLiveCredentials().email;
  }

  async send(
    message: OutboundMessage,
    options: { dry_run?: boolean } = {},
  ): Promise<ChannelSendResult> {
    const dry_run = options.dry_run !== false || !this.configured;
    if (dry_run) {
      return {
        channel: "email",
        ok: true,
        dry_run: true,
        message_id: null,
        error: this.configured ? null : "Email credentials not configured — dry-run only",
      };
    }
    return {
      channel: "email",
      ok: false,
      dry_run: false,
      error: "Live email send disabled in Notification Department V1 verify path",
    };
  }

  formatPreview(message: OutboundMessage): string {
    return `[EMAIL][${message.priority}] ${message.title}\n${message.body}`;
  }
}
