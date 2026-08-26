/**
 * Live Monitoring verify — ALWAYS dry-run. Never sets SOS_AIOS_NOTIFY_LIVE.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runLiveMonitoring } from "./index.js";
import { LIVE_MONITORING_ROOT } from "./LiveMonitoringConfiguration.js";

const REQUIRED_OUTPUTS = [
  "live-monitoring.json",
  "bridge-status.json",
  "publisher-status.json",
  "subscriber-status.json",
  "notification-flow.json",
  "live-monitoring-report.md",
];

async function main(): Promise<void> {
  // Hard safety: strip live flag for verify even if shell exported it
  const previous = process.env.SOS_AIOS_NOTIFY_LIVE;
  delete process.env.SOS_AIOS_NOTIFY_LIVE;

  const result = await runLiveMonitoring({ forceDryRun: true });

  if (previous !== undefined) {
    process.env.SOS_AIOS_NOTIFY_LIVE = previous;
  }

  const reportsOk = REQUIRED_OUTPUTS.every((f) =>
    existsSync(join(LIVE_MONITORING_ROOT, f)),
  );

  const checks = {
    event_publishing: result.checks.event_publishing,
    event_subscriptions: result.checks.event_subscriptions,
    notification_bridge: result.checks.notification_bridge,
    dry_run_preserved: result.checks.dry_run_preserved && result.mode === "dry_run",
    commander_bridge_detected: result.checks.commander_bridge_detected,
    no_duplicate_telegram_stack: result.checks.no_duplicate_telegram_stack,
    report_generation: reportsOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  const lines = [
    "Live Monitoring Verify",
    "======================",
    ...Object.entries(checks).map(
      ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
    ),
    "",
    `Status: ${result.status}`,
    `Mode: ${result.mode} (verify forced)`,
    `Publishers: ${result.publishers.map((p) => `${p.publisher}:${p.events_published}`).join(", ")}`,
    `Subscriptions: ${result.subscriptions.length}`,
    `Deliveries: ${result.deliveries.length}`,
    `Commander bridge: ${result.commander.detected ? "detected" : "MISSING"}`,
    `Duplicate Telegram: ${result.commander.duplicate_telegram_stack ? "YES" : "no"}`,
    `Overall: ${allPass ? "PASS" : "FAIL"}`,
  ];
  console.log(lines.join("\n"));
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
