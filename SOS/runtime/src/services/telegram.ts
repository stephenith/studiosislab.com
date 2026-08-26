import type { RuntimeConfig } from "../config.js";
import { assertTelegramConfigured } from "../config.js";
import type { EventEnvelope } from "../types.js";
import { approvalIdFromEvent, logDispatch } from "../dispatch-logger.js";
import { registerTelegramOutbound } from "../approvals/telegram/outbound-registry.js";
import { lookupByApprovalId } from "../approvals/telegram/outbound-registry.js";
import { traceTelegramSend } from "./telegram-send-trace.js";

export type TelegramSendResult =
  | { ok: true; messageId: number; apiResponse?: unknown }
  | { ok: false; error: string; apiResponse?: unknown };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatTelegramMessage(event: EventEnvelope): string {
  const evidence =
    event.evidence?.length ?
      `\n\n<b>Evidence</b>\n${event.evidence.map((e) => `• ${escapeHtml(e)}`).join("\n")}`
    : "";

  const approval =
    event.requires_approval ?
      `\n\n⚠️ <b>Approval:</b> ${escapeHtml(event.approval_status)}`
    : "";

  return [
    `<b>[${event.priority}] ${escapeHtml(event.title)}</b>`,
    `<i>${escapeHtml(event.type)} · ${escapeHtml(event.agent)}</i>`,
    "",
    escapeHtml(event.body),
    evidence,
    approval,
    "",
    `<code>${event.event_id}</code>`,
  ].join("\n");
}

export async function sendTelegram(
  config: RuntimeConfig,
  event: EventEnvelope,
): Promise<TelegramSendResult> {
  assertTelegramConfigured(config);

  const approvalId = approvalIdFromEvent(event);

  await logDispatch(config, {
    message: "telegram_dispatch_started",
    event_id: event.event_id,
    approval_id: approvalId,
    channel: "telegram",
  });

  if (config.dryRun) {
    return { ok: true, messageId: 0 };
  }

  const token = config.telegramBotToken!;
  const chatId = config.telegramChatId!;
  const text = formatTelegramMessage(event);

  await traceTelegramSend(config, {
    event_id: event.event_id,
    correlation_id: event.correlation_id,
    message_text: text,
    chat_id: chatId,
    delivery_method: "sendTelegram",
    api_called: true,
  });

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  await logDispatch(config, {
    message: "telegram_api_response",
    event_id: event.event_id,
    approval_id: approvalId,
    channel: "telegram",
    api_response: payload,
  });

  if (!response.ok || !payload.ok) {
    const error = payload.description || `Telegram HTTP ${response.status}`;
    await logDispatch(config, {
      message: "telegram_dispatch_failed",
      event_id: event.event_id,
      approval_id: approvalId,
      channel: "telegram",
      error,
    });
    return { ok: false, error, apiResponse: payload };
  }

  await logDispatch(config, {
    message: "telegram_dispatch_success",
    event_id: event.event_id,
    approval_id: approvalId,
    channel: "telegram",
    status: "sent",
    api_response: payload,
  });

  const messageId = payload.result?.message_id ?? 0;
  if (approvalId && messageId > 0) {
    await registerTelegramOutbound(config, {
      approval_id: approvalId,
      event_id: event.event_id,
      chat_id: chatId,
      message_id: messageId,
      sent_at: new Date().toISOString(),
      text_preview: text.slice(0, 200),
    });
  }

  return { ok: true, messageId, apiResponse: payload };
}

export async function editTelegramApprovalStatus(
  config: RuntimeConfig,
  approvalId: string,
  statusLine: string,
  footer: string,
): Promise<TelegramSendResult> {
  assertTelegramConfigured(config);

  if (config.dryRun) {
    return { ok: true, messageId: 0 };
  }

  const outbound = await lookupByApprovalId(config, approvalId);
  if (!outbound) {
    return { ok: false, error: `No outbound Telegram message for ${approvalId}` };
  }

  const text = `${statusLine}\n\n${footer}\n\nApproval ID: <code>${approvalId}</code>`;
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/editMessageText`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: outbound.chat_id,
      message_id: outbound.message_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      error: payload.description || `Telegram editMessage HTTP ${response.status}`,
      apiResponse: payload,
    };
  }

  return { ok: true, messageId: payload.result?.message_id ?? outbound.message_id, apiResponse: payload };
}

/** @deprecated Use sendLifecycleNotification from notification-pipeline.ts */
export async function sendTelegramPlain(
  config: RuntimeConfig,
  text: string,
): Promise<TelegramSendResult> {
  throw new Error(
    "sendTelegramPlain is deprecated. Use sendLifecycleNotification() — all Telegram must flow through the notification pipeline.",
  );
}
