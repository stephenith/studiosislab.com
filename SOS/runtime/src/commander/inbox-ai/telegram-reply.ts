import type { RuntimeConfig } from "../../config.js";
import { assertTelegramConfigured } from "../../config.js";

export async function sendTelegramInboxReply(
  config: RuntimeConfig,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  if (!config.telegramBotToken) {
    return { ok: false, error: "telegram_not_configured" };
  }

  assertTelegramConfigured(config);

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!response.ok || !payload.ok) {
    return { ok: false, error: payload.description ?? "telegram_send_failed" };
  }

  return { ok: true, messageId: payload.result?.message_id };
}
