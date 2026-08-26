/**
 * Thin wrapper around legacy SOS/runtime Telegram services.
 * Does NOT duplicate Telegram implementation — imports existing auth + notification pipeline.
 */
import type { TelegramAdapter } from "./types.js";

type LegacyModules = {
  loadConfig: () => import("../../../runtime/src/config.js").RuntimeConfig;
  sendTelegramInboxReply: (
    config: import("../../../runtime/src/config.js").RuntimeConfig,
    chatId: string,
    text: string,
  ) => Promise<{ ok: boolean; messageId?: number; error?: string }>;
  sendLifecycleNotification: (
    config: import("../../../runtime/src/config.js").RuntimeConfig,
    paths: null,
    request: import("../../../runtime/src/services/notification-pipeline.js").LifecycleNotificationRequest,
  ) => Promise<{ telegram_ok: boolean; error: string | null }>;
};

let cachedModules: LegacyModules | null = null;

async function loadLegacyModules(): Promise<LegacyModules> {
  if (cachedModules) return cachedModules;
  const [configMod, replyMod, notifyMod] = await Promise.all([
    import("../../../runtime/src/config.js"),
    import("../../../runtime/src/commander/inbox-ai/telegram-reply.js"),
    import("../../../runtime/src/services/notification-pipeline.js"),
  ]);
  cachedModules = {
    loadConfig: configMod.loadConfig,
    sendTelegramInboxReply: replyMod.sendTelegramInboxReply,
    sendLifecycleNotification: notifyMod.sendLifecycleNotification,
  };
  return cachedModules;
}

export class LegacyTelegramAdapter implements TelegramAdapter {
  private config: import("../../../runtime/src/config.js").RuntimeConfig | null = null;

  async init(): Promise<void> {
    const mods = await loadLegacyModules();
    this.config = mods.loadConfig();
  }

  private async cfg() {
    if (!this.config) await this.init();
    return this.config!;
  }

  isConfigured(): boolean {
    if (!this.config) {
      try {
        const mods = loadLegacyModules();
        void mods;
      } catch {
        return false;
      }
    }
    return Boolean(this.config?.telegramBotToken && this.config?.telegramChatId);
  }

  async sendInboxReply(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const mods = await loadLegacyModules();
    const config = await this.cfg();
    const result = await mods.sendTelegramInboxReply(config, chatId, text);
    return { ok: result.ok, error: result.error };
  }

  async sendCompletionNotification(input: {
    correlation_id: string;
    title: string;
    body: string;
    chat_id: string;
    plan_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string }> {
    const mods = await loadLegacyModules();
    const config = await this.cfg();
    const result = await mods.sendLifecycleNotification(config, null, {
      correlation_id: input.correlation_id,
      source: "saios-gateway",
      caller: "telegram-bridge",
      title: input.title,
      body: input.body,
      type: "task_complete",
      priority: "P2",
      metadata: {
        ...input.metadata,
        chat_id: input.chat_id,
        plan_id: input.plan_id,
        saios: true,
      },
    });
    return { ok: result.telegram_ok, error: result.error };
  }
}

export class RecordingTelegramAdapter implements TelegramAdapter {
  readonly inboxReplies: Array<{ chat_id: string; text: string }> = [];
  readonly completionNotifications: Array<{
    chat_id: string;
    title: string;
    body: string;
    plan_id: string;
  }> = [];

  isConfigured(): boolean {
    return true;
  }

  async sendInboxReply(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
    this.inboxReplies.push({ chat_id: chatId, text });
    return { ok: true };
  }

  async sendCompletionNotification(input: {
    correlation_id: string;
    title: string;
    body: string;
    chat_id: string;
    plan_id: string;
  }): Promise<{ ok: boolean; error?: string }> {
    this.completionNotifications.push({
      chat_id: input.chat_id,
      title: input.title,
      body: input.body,
      plan_id: input.plan_id,
    });
    return { ok: true };
  }
}
