/**
 * Routes notifications to channels according to priority rules.
 */
import type { NotificationChannelAdapter, OutboundMessage } from "./NotificationChannelAdapter.js";
import type { RoutingDecision } from "./NotificationPriorityEngine.js";
import type { ChannelSendResult, DigestBundle, LedgerEntry } from "./types.js";

export class ConsoleNotificationAdapter implements NotificationChannelAdapter {
  readonly channel = "console" as const;
  readonly configured = true;

  async send(
    message: OutboundMessage,
    options: { dry_run?: boolean } = {},
  ): Promise<ChannelSendResult> {
    return {
      channel: "console",
      ok: true,
      dry_run: options.dry_run !== false,
      message_id: `console-${Date.now()}`,
    };
  }
}

export async function routeNotifications(input: {
  decisions: RoutingDecision[];
  digest: DigestBundle;
  adapters: NotificationChannelAdapter[];
  dry_run: boolean;
}): Promise<{ results: ChannelSendResult[]; ledger: LedgerEntry[] }> {
  const results: ChannelSendResult[] = [];
  const ledger: LedgerEntry[] = [];
  const now = new Date().toISOString();

  const immediate = input.decisions.filter((d) => d.send_immediately);
  for (const decision of immediate) {
    const message: OutboundMessage = {
      title: decision.alert.title,
      body: decision.alert.message,
      priority: decision.priority,
      type: decision.alert.type,
    };
    for (const adapter of input.adapters) {
      const result = await adapter.send(message, { dry_run: input.dry_run });
      results.push(result);
      ledger.push({
        at: now,
        type: decision.alert.type,
        priority: decision.priority,
        channel: adapter.channel,
        status: result.dry_run ? "dry_run" : result.ok ? "sent" : "failed",
        reason: decision.reason,
        source: decision.alert.source,
        title: decision.alert.title,
      });
    }
  }

  // Digests always go through console + optional telegram/email (dry-run)
  const digestMessage: OutboundMessage = {
    title: "AI OS Daily Digest",
    body: input.digest.daily,
    priority: "INFO",
    type: "DAILY_DIGEST",
  };
  for (const adapter of input.adapters) {
    const result = await adapter.send(digestMessage, { dry_run: input.dry_run });
    results.push(result);
    ledger.push({
      at: now,
      type: "DAILY_DIGEST",
      priority: "INFO",
      channel: adapter.channel,
      status: result.dry_run ? "dry_run" : result.ok ? "sent" : "failed",
      reason: "Digest routing",
      source: "notification-department",
      title: digestMessage.title,
    });
  }

  // Morning / evening review ledger entries (generated, dry-run)
  for (const review of [
    { type: "MORNING_REVIEW" as const, body: input.digest.morning },
    { type: "EVENING_REVIEW" as const, body: input.digest.evening },
  ]) {
    for (const adapter of input.adapters) {
      const result = await adapter.send(
        {
          title: review.type,
          body: review.body,
          priority: "INFO",
          type: review.type,
        },
        { dry_run: true },
      );
      results.push(result);
      ledger.push({
        at: now,
        type: review.type,
        priority: "INFO",
        channel: adapter.channel,
        status: "dry_run",
        reason: `${review.type} briefing payload prepared`,
        source: "notification-department",
        title: review.type,
      });
    }
  }

  return { results, ledger };
}
