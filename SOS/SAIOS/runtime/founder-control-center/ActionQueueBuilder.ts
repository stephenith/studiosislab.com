/**
 * Build prioritized founder action queue from aggregated signals.
 */
import type {
  AiOsStatusSection,
  FounderAction,
  NotificationSection,
  ReleaseSection,
  SecuritySection,
  TimelineSection,
  TodaysWorkSection,
} from "./types.js";

export function buildActionQueue(input: {
  ai_os_status: AiOsStatusSection;
  todays_work: TodaysWorkSection;
  security: SecuritySection;
  timeline: TimelineSection;
  releases: ReleaseSection;
  notifications: NotificationSection;
}): FounderAction[] {
  const actions: FounderAction[] = [];

  for (const item of input.todays_work.pending_founder_approvals) {
    actions.push({
      id: `approve-${actions.length}`,
      priority: "P0",
      title: "Approve Founder Review",
      detail: item,
      source: "timeline / project-state",
      category: "founder-approval",
    });
  }

  const pendingReleases = Number(input.todays_work.pending_releases);
  if (!Number.isNaN(pendingReleases) && pendingReleases > 0) {
    actions.push({
      id: "publish-ready",
      priority: "P1",
      title: "Publish ready templates",
      detail: `${pendingReleases} package(s) ready_to_publish / pending release`,
      source: "production-dashboard",
      category: "release",
    });
  }

  if (/conflict/i.test(input.releases.catalog_integrity) && !/conflicts=0/.test(input.releases.catalog_integrity)) {
    actions.push({
      id: "catalog-conflict",
      priority: "P1",
      title: "Resolve catalog conflict",
      detail: input.releases.catalog_integrity,
      source: "catalog-integrity",
      category: "catalog",
    });
  }

  if (String(input.security.security_level).toUpperCase() === "ORANGE" ||
      String(input.security.security_level).toUpperCase() === "RED" ||
      String(input.security.security_level).toUpperCase() === "CRITICAL") {
    const diskRisk = input.security.current_risks.find((r) => /disk/i.test(r));
    actions.push({
      id: "security-attention",
      priority: diskRisk ? "P1" : "P2",
      title: diskRisk ? "Disk cleanup" : "Review security risks",
      detail: diskRisk ?? input.security.current_risks.slice(0, 3).join("; "),
      source: "security-department",
      category: "security",
    });
  }

  for (const overdue of input.timeline.overdue_items) {
    if (overdue === "none") continue;
    actions.push({
      id: `overdue-${actions.length}`,
      priority: "P0",
      title: "Clear overdue timeline item",
      detail: overdue,
      source: "timeline-department",
      category: "timeline",
    });
  }

  if (Number(input.notifications.critical_alerts) > 0) {
    actions.push({
      id: "critical-alerts",
      priority: "P0",
      title: "Review critical alerts",
      detail: `${input.notifications.critical_alerts} critical notification(s)`,
      source: "notification-department",
      category: "notifications",
    });
  }

  if (String(input.ai_os_status.overall_health) === "DEGRADED") {
    actions.push({
      id: "aios-degraded",
      priority: "P2",
      title: "Review AI OS degraded health",
      detail: `Overall ${input.ai_os_status.overall_health}; security=${input.ai_os_status.security}`,
      source: "founder-control-center",
      category: "ops",
    });
  }

  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return actions.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
