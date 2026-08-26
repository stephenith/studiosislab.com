/**
 * Append-only notification ledger.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NOTIFICATION_DEPARTMENT_ROOT } from "./NotificationConfig.js";
import type { LedgerEntry } from "./types.js";

export function writeNotificationLedger(entries: LedgerEntry[]): {
  ledger_path: string;
  summary_path: string;
  summary: Record<string, unknown>;
} {
  mkdirSync(NOTIFICATION_DEPARTMENT_ROOT, { recursive: true });
  const ledger_path = join(NOTIFICATION_DEPARTMENT_ROOT, "notification-ledger.jsonl");
  const summary_path = join(NOTIFICATION_DEPARTMENT_ROOT, "notification-ledger-summary.json");

  for (const entry of entries) {
    appendFileSync(ledger_path, `${JSON.stringify(entry)}\n`);
  }

  const all = existsSync(ledger_path)
    ? readFileSync(ledger_path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LedgerEntry)
    : entries;

  const byStatus: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const e of all) {
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    byChannel[e.channel] = (byChannel[e.channel] ?? 0) + 1;
    byPriority[e.priority] = (byPriority[e.priority] ?? 0) + 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    total_entries: all.length,
    latest_batch: entries.length,
    by_status: byStatus,
    by_channel: byChannel,
    by_priority: byPriority,
    live_sends: byStatus.sent ?? 0,
    dry_runs: byStatus.dry_run ?? 0,
  };

  writeFileSync(summary_path, JSON.stringify(summary, null, 2));
  return { ledger_path, summary_path, summary };
}
