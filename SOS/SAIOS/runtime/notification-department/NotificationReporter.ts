/**
 * Persists Notification Department reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NOTIFICATION_DEPARTMENT_ROOT } from "./NotificationConfig.js";
import type { NotificationDepartmentResult } from "./types.js";

export function renderNotificationReport(result: NotificationDepartmentResult): string {
  return [
    "# Notification Department Report",
    "",
    `**Generated:** ${result.generated_at}`,
    `**Status:** ${result.status}`,
    `**Dry run:** ${result.dry_run}`,
    `**Live credentials configured:** ${result.live_credentials_configured}`,
    "",
    "## Sources",
    "",
    ...result.sources.map(
      (s) => `- **${s.id}** — ${s.status} — ${s.summary}`,
    ),
    "",
    "## Channels",
    "",
    ...Object.entries(result.channels).map(
      ([ch, meta]) =>
        `- ${ch}: configured=${meta.configured}, dry_run=${meta.dry_run}`,
    ),
    "",
    "## Alerts collected",
    "",
    ...(result.alerts.length
      ? result.alerts.map((a) => `- [${a.priority}] ${a.title}`)
      : ["- None"]),
    "",
    "## Recommended next action",
    "",
    result.digest.structured.recommended_next_action,
    "",
    "> Live notifications remain dry-run until VPS secrets are configured.",
    "",
  ].join("\n");
}

export function persistNotificationReports(result: NotificationDepartmentResult): string[] {
  mkdirSync(NOTIFICATION_DEPARTMENT_ROOT, { recursive: true });
  const files = {
    sources: join(NOTIFICATION_DEPARTMENT_ROOT, "notification-sources.json"),
    digest: join(NOTIFICATION_DEPARTMENT_ROOT, "notification-digest.json"),
    morning: join(NOTIFICATION_DEPARTMENT_ROOT, "morning-digest.md"),
    evening: join(NOTIFICATION_DEPARTMENT_ROOT, "evening-digest.md"),
    daily: join(NOTIFICATION_DEPARTMENT_ROOT, "daily-summary.md"),
    report: join(NOTIFICATION_DEPARTMENT_ROOT, "notification-report.md"),
  };

  writeFileSync(
    files.sources,
    JSON.stringify(
      {
        generated_at: result.generated_at,
        sources: result.sources,
      },
      null,
      2,
    ),
  );
  writeFileSync(files.digest, JSON.stringify(result.digest, null, 2));
  writeFileSync(files.morning, result.digest.morning);
  writeFileSync(files.evening, result.digest.evening);
  writeFileSync(files.daily, result.digest.daily);
  writeFileSync(files.report, renderNotificationReport(result));

  return Object.values(files);
}
