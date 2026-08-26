/**
 * Persist Founder Control Center reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FCC_ROOT } from "./FounderControlConfiguration.js";
import type { FounderControlCenterResult, FounderDashboard } from "./types.js";

function sectionMd(title: string, rows: Array<[string, string]>): string {
  return [
    `## ${title}`,
    ``,
    ...rows.map(([k, v]) => `- **${k}:** ${v}`),
    ``,
  ].join("\n");
}

export function renderSummaryMarkdown(dashboard: FounderDashboard): string {
  return [
    `# Founder Control Center Summary`,
    ``,
    `Generated: ${dashboard.generated_at}`,
    ``,
    `**Overall health:** ${dashboard.ai_os_status.overall_health}`,
    ``,
    `**Recommended next action:** ${dashboard.recommended_next_action}`,
    ``,
    sectionMd("AI OS Status", [
      ["Runtime", dashboard.ai_os_status.runtime],
      ["Security", dashboard.ai_os_status.security],
      ["Website", dashboard.ai_os_status.website],
      ["Notifications", dashboard.ai_os_status.notifications],
      ["Timeline", dashboard.ai_os_status.timeline],
      ["Event Bus", dashboard.ai_os_status.event_bus],
      ["Deployment", dashboard.ai_os_status.deployment],
    ]),
    `## Action Queue`,
    ``,
    ...(dashboard.action_queue.length
      ? dashboard.action_queue.map(
          (a) => `- [${a.priority}] **${a.title}** — ${a.detail}`,
        )
      : ["- none"]),
    ``,
  ].join("\n");
}

export function renderMorningDashboard(dashboard: FounderDashboard): string {
  return [
    `# Morning Dashboard`,
    ``,
    `Good morning. One screen for the day.`,
    ``,
    `Generated: ${dashboard.generated_at}`,
    ``,
    `## Health`,
    ``,
    `- Overall: **${dashboard.ai_os_status.overall_health}**`,
    `- Website: ${dashboard.ai_os_status.website}`,
    `- Security: ${dashboard.ai_os_status.security}`,
    `- Runtime: ${dashboard.ai_os_status.runtime}`,
    ``,
    `## Today's focus`,
    ``,
    `- Pending approvals: ${dashboard.todays_work.pending_founder_approvals.join("; ") || "none"}`,
    `- Pending releases: ${dashboard.todays_work.pending_releases}`,
    `- Timeline reminders: ${dashboard.timeline.todays_reminders.join("; ")}`,
    ``,
    `## Morning digest (from Notification Department)`,
    ``,
    dashboard.notifications.morning_digest,
    ``,
    `## Do this first`,
    ``,
    `**${dashboard.recommended_next_action}**`,
    ``,
  ].join("\n");
}

export function renderEveningDashboard(dashboard: FounderDashboard): string {
  return [
    `# Evening Dashboard`,
    ``,
    `End-of-day operational close.`,
    ``,
    `Generated: ${dashboard.generated_at}`,
    ``,
    `## Day close health`,
    ``,
    `- Overall: **${dashboard.ai_os_status.overall_health}**`,
    `- Security risks: ${dashboard.security.current_risks.slice(0, 3).join("; ")}`,
    `- Unread alerts: ${dashboard.notifications.unread_alerts}`,
    `- Critical alerts: ${dashboard.notifications.critical_alerts}`,
    ``,
    `## Production snapshot`,
    ``,
    `- Batch: ${dashboard.resume_factory.current_batch}`,
    `- Generated: ${dashboard.resume_factory.templates_generated}`,
    `- Published: ${dashboard.resume_factory.templates_published}`,
    `- Ready: ${dashboard.resume_factory.templates_ready}`,
    `- Latest release: ${dashboard.releases.latest_release}`,
    ``,
    `## Evening digest (from Notification Department)`,
    ``,
    dashboard.notifications.evening_digest,
    ``,
    `## Carry into tomorrow`,
    ``,
    `**${dashboard.recommended_next_action}**`,
    ``,
  ].join("\n");
}

export function renderFullReport(result: FounderControlCenterResult): string {
  const d = result.dashboard;
  return [
    `# Founder Control Report`,
    ``,
    `Single operational headquarters for the AI Operating System — Agent #108.`,
    `Aggregation only. No business logic.`,
    ``,
    `## Status: ${result.status}`,
    ``,
    `Generated: ${result.generated_at}`,
    ``,
    renderSummaryMarkdown(d),
    sectionMd("Today's Work", [
      ["Generated today", String(d.todays_work.templates_generated_today)],
      ["Reviewed today", String(d.todays_work.templates_reviewed_today)],
      ["Published today", String(d.todays_work.templates_published_today)],
      ["Pending approvals", d.todays_work.pending_founder_approvals.join("; ") || "none"],
      ["Pending releases", String(d.todays_work.pending_releases)],
      ["Pending notifications", String(d.todays_work.pending_notifications)],
    ]),
    sectionMd("Resume Factory", [
      ["Batch", d.resume_factory.current_batch],
      ["Generated", String(d.resume_factory.templates_generated)],
      ["Published", String(d.resume_factory.templates_published)],
      ["Ready", String(d.resume_factory.templates_ready)],
      ["Avg quality", String(d.resume_factory.average_quality)],
      ["Competitive", String(d.resume_factory.competitive_score)],
      ["Latest", d.resume_factory.latest_production],
    ]),
    sectionMd("Website", [
      ["Health", d.website.website_health],
      ["Catalog", d.website.runtime_catalog],
      ["Gallery", d.website.gallery],
      ["SEO", d.website.seo],
      ["Editor", d.website.editor],
      ["Download", d.website.download_flow],
      ["Deployment", d.website.latest_deployment],
    ]),
    sectionMd("Security", [
      ["Level", d.security.security_level],
      ["Risks", d.security.current_risks.join("; ")],
      ["Disk", d.security.disk],
      ["Environment", d.security.environment],
      ["Runtime protection", d.security.runtime_protection],
      ["Backup", d.security.backup_status],
    ]),
    sectionMd("Timeline", [
      ["Sprint", d.timeline.current_sprint],
      ["Day", d.timeline.current_day],
      ["Reminders", d.timeline.todays_reminders.join("; ")],
      ["Milestones", d.timeline.upcoming_milestones.join("; ")],
      ["Overdue", d.timeline.overdue_items.join("; ")],
    ]),
    sectionMd("Notifications", [
      ["Unread", String(d.notifications.unread_alerts)],
      ["Critical", String(d.notifications.critical_alerts)],
      ["Warnings", String(d.notifications.warnings)],
    ]),
    sectionMd("Releases", [
      ["Latest", d.releases.latest_release],
      ["Next candidate", d.releases.next_release_candidate],
      ["Rollback", d.releases.rollback_availability],
      ["Catalog", d.releases.catalog_integrity],
    ]),
    sectionMd("Performance", [
      ["Tracked", String(d.performance.templates_tracked)],
      ["Published", String(d.performance.published)],
      ["Ready", String(d.performance.ready)],
      ["Uptime", d.performance.runtime_uptime],
      ["Heartbeat", d.performance.heartbeat],
      ["Departments", String(d.performance.department_count)],
    ]),
    `## Discovered departments`,
    ``,
    ...result.departments.map(
      (dep) =>
        `- **${dep.label}** (\`${dep.id}\`) — ${dep.available ? "available" : "missing"} · ${dep.status}`,
    ),
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
  ].join("\n");
}

export function writeFounderControlReports(
  result: FounderControlCenterResult,
): void {
  mkdirSync(FCC_ROOT, { recursive: true });

  writeFileSync(
    join(FCC_ROOT, "founder-control-center.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        department_count: result.departments.length,
        available_count: result.departments.filter((d) => d.available).length,
        overall_health: result.dashboard.ai_os_status.overall_health,
        recommended_next_action: result.dashboard.recommended_next_action,
        checks: result.checks,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(FCC_ROOT, "founder-dashboard.json"),
    JSON.stringify(result.dashboard, null, 2),
  );

  writeFileSync(
    join(FCC_ROOT, "founder-action-queue.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        recommended_next_action: result.dashboard.recommended_next_action,
        actions: result.dashboard.action_queue,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(FCC_ROOT, "founder-summary.md"),
    renderSummaryMarkdown(result.dashboard),
  );
  writeFileSync(
    join(FCC_ROOT, "morning-dashboard.md"),
    renderMorningDashboard(result.dashboard),
  );
  writeFileSync(
    join(FCC_ROOT, "evening-dashboard.md"),
    renderEveningDashboard(result.dashboard),
  );
  writeFileSync(
    join(FCC_ROOT, "founder-control-report.md"),
    renderFullReport(result),
  );
}
