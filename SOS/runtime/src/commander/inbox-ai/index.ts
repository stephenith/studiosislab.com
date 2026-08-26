import type { RuntimeConfig } from "../../config.js";
import type { TelegramInboundMessage } from "../../approvals/telegram/types.js";
import { parseCommanderDecision } from "../../approvals/parser.js";
import { stripApprovalIdFromCommand } from "../../approvals/telegram/extract.js";
import { routeInboxCommand } from "./command-router.js";
import { logInboxResult } from "./inbox-log.js";
import { sendTelegramInboxReply } from "./telegram-reply.js";
import type { InboxAiResponse } from "./types.js";

export function shouldRouteToInboxAi(text: string): boolean {
  const decision = parseCommanderDecision(stripApprovalIdFromCommand(text));
  return decision === null;
}

export async function handleInboxAiMessage(
  config: RuntimeConfig,
  inbound: TelegramInboundMessage,
): Promise<InboxAiResponse> {
  if (!shouldRouteToInboxAi(inbound.text)) {
    return { handled: false };
  }

  const { result, reply } = await routeInboxCommand(config, inbound.text);

  await logInboxResult(config, {
    user_message: inbound.text,
    chat_id: inbound.chat_id,
    user_id: inbound.user_id,
    reply,
    result,
  });

  const sent = await sendTelegramInboxReply(config, inbound.chat_id, reply);
  if (!sent.ok) {
    return {
      handled: true,
      reply,
      result: { ...result, ok: false, error: sent.error ?? "telegram_reply_failed" },
    };
  }

  return { handled: true, reply, result };
}
