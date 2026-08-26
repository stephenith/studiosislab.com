import type { RuntimeConfig } from "../../config.js";
import { loadConfig } from "../../config.js";
import { getPmPaths } from "../../pm/paths.js";
import { loadState } from "../../pm/state.js";
import { parseCommanderDecision } from "../parser.js";
import { processCommanderDecision } from "../processor.js";
import type { ApprovalsPaths } from "../paths.js";
import { getApprovalsPaths } from "../paths.js";
import { loadApprovalRecord } from "../state.js";
import { isTerminalState } from "../machine.js";
import type { InboxMessage } from "../types.js";
import { extractApprovalIdFromText, stripApprovalIdFromCommand } from "./extract.js";
import { logTelegramInbound } from "./inbound-log.js";
import { lookupByMessageId } from "./outbound-registry.js";
import { editTelegramApprovalStatus } from "../../services/telegram.js";
import { handleInboxAiMessage } from "../../commander/inbox-ai/index.js";
import type { TelegramInboundMessage } from "./types.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

function isAuthorizedChat(config: RuntimeConfig, chatId: string): boolean {
  return config.telegramChatId === chatId;
}

function isAuthorizedUser(config: RuntimeConfig, userId?: number): boolean {
  if (!config.telegramAllowedUserIds.length) return true;
  if (userId === undefined) return false;
  return config.telegramAllowedUserIds.includes(String(userId));
}

async function resolveApprovalId(
  config: RuntimeConfig,
  inbound: TelegramInboundMessage,
): Promise<string | null> {
  if (inbound.hint_approval_id) return inbound.hint_approval_id;

  const fromText = extractApprovalIdFromText(inbound.text);
  if (fromText) return fromText;

  if (inbound.reply_to_message_id !== undefined) {
    const byReply = await lookupByMessageId(
      config,
      inbound.chat_id,
      inbound.reply_to_message_id,
    );
    if (byReply) return byReply.approval_id;
  }

  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  const waiting = pmState.waiting_approvals;
  if (waiting.length === 1) {
    return waiting[0].approval_id;
  }

  return null;
}

async function isApprovalExpired(
  paths: ApprovalsPaths,
  approvalId: string,
): Promise<boolean> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const pmState = await loadState(pmPaths);
  const waiting = pmState.waiting_approvals.find((w) => w.approval_id === approvalId);
  if (!waiting?.expires_at) return false;
  return new Date(waiting.expires_at) < new Date();
}

async function isDuplicateReply(
  paths: ApprovalsPaths,
  approvalId: string,
): Promise<boolean> {
  const record = await loadApprovalRecord(paths, approvalId);
  if (record && isTerminalState(record.state)) return true;

  const responseFile = join(paths.pmResponses, `${approvalId}.json`);
  if (!existsSync(responseFile)) return false;
  const data = JSON.parse(await readFile(responseFile, "utf8")) as {
    status?: string;
    command?: string;
  };
  return data.status !== "pending" && Boolean(data.command);
}

function statusBanner(command: string): string {
  const upper = command.toUpperCase();
  if (upper.startsWith("APPROVE")) return "✅ <b>APPROVED</b>";
  if (upper.startsWith("REJECT") || upper === "CANCEL") return "❌ <b>REJECTED</b>";
  if (upper.startsWith("DEFER")) return "⏸ <b>DEFERRED</b>";
  return "ℹ️ <b>UPDATED</b>";
}

export async function processTelegramInboundMessage(
  config: RuntimeConfig,
  paths: ApprovalsPaths,
  inbound: TelegramInboundMessage,
): Promise<{ ok: boolean; error?: string }> {
  await logTelegramInbound(config, {
    message: "reply_received",
    update_id: inbound.update_id,
    chat_id: inbound.chat_id,
    user_id: inbound.user_id,
    command: inbound.text,
  });

  if (!isAuthorizedChat(config, inbound.chat_id)) {
    await logTelegramInbound(config, {
      message: "unauthorized_chat",
      update_id: inbound.update_id,
      chat_id: inbound.chat_id,
      user_id: inbound.user_id,
      error: `Expected chat ${config.telegramChatId}`,
    });
    return { ok: false, error: "unauthorized_chat" };
  }

  if (!isAuthorizedUser(config, inbound.user_id)) {
    await logTelegramInbound(config, {
      message: "unauthorized_user",
      update_id: inbound.update_id,
      chat_id: inbound.chat_id,
      user_id: inbound.user_id,
      error: "User not in SOS_TELEGRAM_ALLOWED_USER_IDS",
    });
    return { ok: false, error: "unauthorized_user" };
  }

  const decision = parseCommanderDecision(stripApprovalIdFromCommand(inbound.text));
  if (!decision) {
    const ai = await handleInboxAiMessage(config, inbound);
    if (ai.handled) {
      await logTelegramInbound(config, {
        message: "inbox_ai_handled",
        update_id: inbound.update_id,
        chat_id: inbound.chat_id,
        command: inbound.text,
        details: {
          intent: ai.result?.intent,
          ok: ai.result?.ok,
        },
      });
      return { ok: true };
    }

    await logTelegramInbound(config, {
      message: "parse_failed",
      update_id: inbound.update_id,
      chat_id: inbound.chat_id,
      command: inbound.text,
      error: "Invalid CCP syntax",
    });
    return { ok: false, error: "parse_failed" };
  }

  await logTelegramInbound(config, {
    message: "reply_parsed",
    update_id: inbound.update_id,
    command: decision.raw,
    details: decision,
  });

  const approvalId = await resolveApprovalId(config, inbound);
  if (!approvalId) {
    await logTelegramInbound(config, {
      message: "match_failed",
      update_id: inbound.update_id,
      command: decision.raw,
      error: "Could not match approval_id",
    });
    return { ok: false, error: "match_failed" };
  }

  await logTelegramInbound(config, {
    message: "approval_matched",
    update_id: inbound.update_id,
    approval_id: approvalId,
    command: decision.raw,
  });

  if (await isDuplicateReply(paths, approvalId)) {
    await logTelegramInbound(config, {
      message: "duplicate_ignored",
      update_id: inbound.update_id,
      approval_id: approvalId,
      command: decision.raw,
    });
    return { ok: false, error: "duplicate_ignored" };
  }

  if (await isApprovalExpired(paths, approvalId)) {
    await logTelegramInbound(config, {
      message: "approval_expired",
      update_id: inbound.update_id,
      approval_id: approvalId,
      command: decision.raw,
    });
    return { ok: false, error: "approval_expired" };
  }

  const inboxMsg: InboxMessage = {
    approval_id: approvalId,
    command: decision.raw,
    option: decision.option_key,
    notes: decision.notes,
    timestamp: inbound.received_at,
  };

  await logTelegramInbound(config, {
    message: "resume_started",
    update_id: inbound.update_id,
    approval_id: approvalId,
    command: decision.raw,
  });

  const result = await processCommanderDecision(paths, inboxMsg);

  if (!result.ok) {
    await logTelegramInbound(config, {
      message: decision.command === "REJECT" || decision.command === "CANCEL" ?
        "approval_rejected"
      : "parse_failed",
      update_id: inbound.update_id,
      approval_id: approvalId,
      command: decision.raw,
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  const accepted =
    decision.command === "APPROVE" || decision.command === "DELEGATE";
  await logTelegramInbound(config, {
    message: accepted ? "approval_accepted" : "approval_rejected",
    update_id: inbound.update_id,
    approval_id: approvalId,
    command: decision.raw,
    details: result,
  });

  const edited = await editTelegramApprovalStatus(
    config,
    approvalId,
    statusBanner(decision.raw),
    `Commander reply: <code>${decision.raw}</code>`,
  );
  if (edited.ok) {
    await logTelegramInbound(config, {
      message: "telegram_message_updated",
      update_id: inbound.update_id,
      approval_id: approvalId,
      details: { message_id: edited.messageId },
    });
  }

  await logTelegramInbound(config, {
    message: "resume_completed",
    update_id: inbound.update_id,
    approval_id: approvalId,
    command: decision.raw,
    details: { pm_resumed: result.pm_resumed, record_state: result.record_state },
  });

  return { ok: true };
}

export function mapApiMessage(
  updateId: number,
  message: NonNullable<import("./poll.js").TelegramApiUpdate["message"]>,
): TelegramInboundMessage {
  return {
    update_id: updateId,
    message_id: message.message_id,
    chat_id: String(message.chat.id),
    user_id: message.from?.id,
    username: message.from?.username,
    text: message.text ?? "",
    reply_to_message_id: message.reply_to_message?.message_id,
    received_at: new Date(message.date * 1000).toISOString(),
  };
}
