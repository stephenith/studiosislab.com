/**
 * Persist live-monitoring reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIVE_MONITORING_ROOT } from "./LiveMonitoringConfiguration.js";
import type { LiveMonitoringResult } from "./types.js";

export function writeLiveMonitoringReports(result: LiveMonitoringResult): void {
  mkdirSync(LIVE_MONITORING_ROOT, { recursive: true });

  writeFileSync(
    join(LIVE_MONITORING_ROOT, "live-monitoring.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        mode: result.mode,
        checks: result.checks,
        publishers: result.publishers.length,
        subscriptions: result.subscriptions.length,
        deliveries: result.deliveries.length,
        bridge_calls: result.bridge_calls.length,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_MONITORING_ROOT, "bridge-status.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        mode: result.mode,
        commander: result.commander,
        bridge_calls: result.bridge_calls,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_MONITORING_ROOT, "publisher-status.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        publishers: result.publishers,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_MONITORING_ROOT, "subscriber-status.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        subscriptions: result.subscriptions,
        deliveries: result.deliveries,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_MONITORING_ROOT, "notification-flow.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        flow: result.flow,
        mode: result.mode,
        note: "Live delivery requires SOS_AIOS_NOTIFY_LIVE=1. Verify is always dry-run.",
      },
      null,
      2,
    ),
  );

  const report = [
    `# Live Monitoring Report`,
    ``,
    `AI OS → Event Bus → Notification subscriber → Commander bridge — Agent #107.`,
    `Reuses SOS/runtime sendLifecycleNotification. No duplicate Telegram stack.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Mode | ${result.mode} |`,
    `| Generated | ${result.generated_at} |`,
    `| Commander bridge | ${result.commander.detected ? "detected" : "MISSING"} |`,
    `| Duplicate Telegram | ${result.commander.duplicate_telegram_stack ? "YES (bad)" : "no"} |`,
    `| Live flag | ${result.commander.live_flag}=${result.commander.live_enabled ? "1" : "0"} |`,
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
    `## Publishers`,
    ``,
    ...result.publishers.map(
      (p) =>
        `- **${p.publisher}** — ${p.events_published} event(s): ${p.event_types.join(", ") || "none"} (${p.source_available ? "source ok" : "source missing"})`,
    ),
    ``,
    `## Subscribers`,
    ``,
    ...result.subscriptions.map(
      (s) => `- ${s.department} ← \`${s.event_type}\``,
    ),
    ``,
    `## Flow`,
    ``,
    ...result.flow.map((f) => `${f.step}. ${f.from} → ${f.to} (${f.via})`),
    ``,
    `## Deliveries`,
    ``,
    ...result.deliveries
      .slice(0, 20)
      .map(
        (d) =>
          `- \`${d.event_type}\` [${d.mode}] ${d.delivery_status} — ${d.note}`,
      ),
    ``,
  ].join("\n");

  writeFileSync(
    join(LIVE_MONITORING_ROOT, "live-monitoring-report.md"),
    report,
  );
}
