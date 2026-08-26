import type { RuntimeConfig } from "../config.js";
import type { EventEnvelope } from "../types.js";
import { sendTelegram, formatTelegramMessage } from "./telegram.js";
import { traceTelegramSend } from "./telegram-send-trace.js";

export type TransportDeliveryStatus = "sent" | "failed" | "mock";

export type TransportDeliveryResult = {
  ok: boolean;
  delivery_status: TransportDeliveryStatus;
  message_id: number | null;
  error: string | null;
  api_called: boolean;
};

export interface NotificationTransport {
  send(config: RuntimeConfig, event: EventEnvelope): Promise<TransportDeliveryResult>;
}

export function isMockNotificationMode(): boolean {
  return process.env.SOS_NOTIFICATION_MODE === "mock";
}

export function getNotificationMode(): "production" | "mock" {
  return isMockNotificationMode() ? "mock" : "production";
}

class ProductionTransport implements NotificationTransport {
  async send(config: RuntimeConfig, event: EventEnvelope): Promise<TransportDeliveryResult> {
    const tg = await sendTelegram(config, event);
    return {
      ok: tg.ok,
      delivery_status: tg.ok ? "sent" : "failed",
      message_id: tg.ok ? tg.messageId : null,
      error: tg.ok ? null : tg.error,
      api_called: true,
    };
  }
}

class MockTransport implements NotificationTransport {
  async send(config: RuntimeConfig, event: EventEnvelope): Promise<TransportDeliveryResult> {
    const text = formatTelegramMessage(event);
    await traceTelegramSend(config, {
      event_id: event.event_id,
      correlation_id: event.correlation_id,
      message_text: text,
      chat_id: null,
      delivery_method: "mockTransport",
      api_called: false,
    });
    return {
      ok: true,
      delivery_status: "mock",
      message_id: null,
      error: null,
      api_called: false,
    };
  }
}

export function createNotificationTransport(): NotificationTransport {
  if (isMockNotificationMode()) {
    return new MockTransport();
  }
  return new ProductionTransport();
}
