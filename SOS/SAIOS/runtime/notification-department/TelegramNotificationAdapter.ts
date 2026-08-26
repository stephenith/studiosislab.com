/**
 * Telegram adapter — dry-run by default; optionally uses SOS/runtime sendTelegram shape.
 * Does not import SOS/runtime modules (isolated). Formats payloads compatible with existing service.
 */
import type { NotificationChannelAdapter, OutboundMessage } from "./NotificationChannelAdapter.js";
import type { ChannelSendResult } from "./types.js";
import { detectLiveCredentials } from "./NotificationConfig.js";

export class TelegramNotificationAdapter implements NotificationChannelAdapter {
  readonly channel = "telegram" as const;
  readonly configured: boolean;

  constructor() {
    this.configured = detectLiveCredentials().telegram;
  }

  async send(
    message: OutboundMessage,
    options: { dry_run?: boolean } = {},
  ): Promise<ChannelSendResult> {
    const dry_run = options.dry_run !== false || !this.configured;
    if (dry_run) {
      return {
        channel: "telegram",
        ok: true,
        dry_run: true,
        message_id: null,
        error: this.configured
          ? null
          : "Telegram credentials not configured — dry-run only",
      };
    }

    // Live path reserved for VPS secrets; verify always dry-runs.
    return {
      channel: "telegram",
      ok: false,
      dry_run: false,
      error: "Live Telegram send disabled in Notification Department V1 verify path",
    };
  }

  formatPreview(message: OutboundMessage): string {
    return `[TG][${message.priority}] ${message.title}\n${message.body}`;
  }
}
