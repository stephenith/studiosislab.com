/**
 * Assembles canonical TimelineState from all trackers.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDeadlines } from "./DeadlineTracker.js";
import { buildHistoricalEvents } from "./HistoricalTimeline.js";
import { buildMilestones } from "./MilestoneManager.js";
import { buildPendingWork } from "./PendingWorkTracker.js";
import { REPO_ROOT, type TimelineConfig } from "./TimelineConfig.js";
import { daysBetween, readTimelineClock } from "./TimelineClock.js";
import { buildSprintState } from "./SprintManager.js";
import type { TimelineState } from "./types.js";

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function buildTimelineState(config: TimelineConfig): {
  state: TimelineState;
  events: ReturnType<typeof buildHistoricalEvents>["events"];
} {
  const clock = readTimelineClock(new Date(), config.timezone);
  const statePath = join(REPO_ROOT, "SOS/project-state.json");
  const project = readJson<{
    latest_agent?: string;
    next_agent?: string;
    latest_founder_review?: string;
    latest_release?: string;
    latest_catalog?: string;
    pending_actions?: string[];
    factory_v1?: { status?: string };
    operations?: {
      website_department?: { status?: string };
      notification_department?: { status?: string };
    };
    history?: Array<{ at: string; type: string; summary: string; ref?: string }>;
    discovery?: { publication_queue?: unknown[]; published_templates?: string[] };
  }>(statePath);

  const dashboard = readJson<{
    factory_health?: {
      templates_generated?: number;
      templates_published?: number;
      templates_ready_to_publish?: number;
      templates_waiting_founder?: number;
    };
  }>(join(REPO_ROOT, "SOS/07_LOGS/saios/production-dashboard/dashboard.json"));

  const conflicts = readJson<{ conflicts?: unknown[] }>(
    join(REPO_ROOT, "SOS/07_LOGS/saios/catalog-integrity/catalog-conflicts.json"),
  );

  const hist = buildHistoricalEvents({
    repoRoot: REPO_ROOT,
    projectHistory: project?.history ?? [],
  });

  const sources = [...hist.sources];
  const dashPath = join(REPO_ROOT, "SOS/07_LOGS/saios/production-dashboard/dashboard.json");
  sources.push({
    id: "production-dashboard",
    path: dashPath,
    status: existsSync(dashPath) ? "available" : "unavailable",
  });
  const statusMd = join(REPO_ROOT, "SOS/PROJECT_STATUS.md");
  sources.push({
    id: "project-status-md",
    path: statusMd,
    status: existsSync(statusMd) ? "available" : "unavailable",
  });

  const pending = buildPendingWork({
    pendingActions: project?.pending_actions ?? [],
    readyToPublish:
      dashboard?.factory_health?.templates_ready_to_publish ??
      project?.discovery?.publication_queue?.length ??
      0,
    waitingFounder: dashboard?.factory_health?.templates_waiting_founder ?? 0,
    catalogConflicts: conflicts?.conflicts?.length ?? 0,
    history: project?.history ?? [],
  });

  const deadlines = buildDeadlines({
    clock,
    pending,
    founderReviewSlaDays: config.founder_review_sla_days,
    publicationSlaDays: Number(config.publication_ready_sla_days) || 7,
  });

  const milestones = buildMilestones({
    events: hist.events,
    factoryStable: project?.factory_v1?.status === "STABLE",
    websiteReady: Boolean(project?.operations?.website_department?.status),
    notificationReady: project?.operations?.notification_department?.status === "READY",
    latestRelease: project?.latest_release ?? null,
  });
  // Mark timeline milestone completed when this builder runs successfully
  const timelineMs = milestones.find((m) => m.id === "ms-timeline-dept");
  if (timelineMs) {
    timelineMs.status = "completed";
    timelineMs.completed_at = clock.date;
  }

  const sprint = buildSprintState(clock, config);
  const overdue = deadlines.filter((d) => d.status === "overdue");
  const blocked = pending.filter((p) => p.status === "blocked");

  const state: TimelineState = {
    generated_at: clock.now_iso,
    clock,
    sprint,
    project_age_days: Math.max(0, daysBetween(config.project_epoch, clock.date)),
    latest_agent: project?.latest_agent ?? "unknown",
    next_agent: project?.next_agent ?? "unknown",
    latest_founder_review: project?.latest_founder_review ?? "unknown",
    latest_release: project?.latest_release ?? "unknown",
    latest_publication: project?.latest_catalog ?? "unknown",
    templates_generated: dashboard?.factory_health?.templates_generated ?? null,
    templates_published:
      dashboard?.factory_health?.templates_published ??
      project?.discovery?.published_templates?.length ??
      null,
    templates_ready:
      dashboard?.factory_health?.templates_ready_to_publish ??
      project?.discovery?.publication_queue?.length ??
      null,
    pending_founder_reviews: (project?.pending_actions ?? []).filter((a) =>
      a.toLowerCase().includes("founder"),
    ),
    pending_publication:
      dashboard?.factory_health?.templates_ready_to_publish ??
      project?.discovery?.publication_queue?.length ??
      0,
    milestones,
    deadlines,
    pending_work: pending,
    overdue_tasks: overdue,
    blocked_tasks: blocked,
    sources,
  };

  return { state, events: hist.events };
}
