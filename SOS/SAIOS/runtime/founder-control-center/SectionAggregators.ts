/**
 * Aggregate all Founder Control Center sections from existing department logs.
 * Read-only — no business logic.
 */
import { na, readJsonSafe, readTextSafe } from "./fcc-utils.js";
import type {
  AiOsStatusSection,
  FounderDashboard,
  HealthTone,
  NotificationSection,
  PerformanceSection,
  ReleaseSection,
  ResumeFactorySection,
  SecuritySection,
  TimelineSection,
  TodaysWorkSection,
  WebsiteSection,
} from "./types.js";
import type { FounderAction } from "./types.js";
import { buildActionQueue } from "./ActionQueueBuilder.js";
import { recommendNextAction } from "./RecommendationEngine.js";

function overallHealth(parts: string[]): HealthTone {
  const upper = parts.map((p) => p.toUpperCase());
  if (upper.some((p) => p.includes("CRITICAL") || p.includes("DOWN") || p.includes("BLOCKED"))) {
    return "CRITICAL";
  }
  if (upper.some((p) => p.includes("ORANGE") || p.includes("DEGRADED") || p.includes("WARNING") || p.includes("RED"))) {
    return "DEGRADED";
  }
  if (upper.every((p) => /HEALTHY|READY|RUNNING|STABLE|GREEN|OK/.test(p))) {
    return "HEALTHY";
  }
  return "WARNING";
}

export function aggregateAiOsStatus(): AiOsStatusSection {
  const ops = readJsonSafe<{
    operations?: Record<string, { status?: string; health?: string; security_level?: string }>;
  }>("SOS/project-state.json").data?.operations ?? {};

  const runtime = na(ops.runtime_manager?.status ?? ops.runtime_manager?.health, "UNKNOWN");
  const security = na(
    ops.security_department?.security_level ?? ops.security_department?.status,
    "UNKNOWN",
  );
  const website = na(ops.website_department?.status, "UNKNOWN");
  const notifications = na(ops.notification_department?.status, "UNKNOWN");
  const timeline = na(ops.timeline_department?.status, "UNKNOWN");
  const event_bus = na(ops.event_bus?.status, "UNKNOWN");
  const deployment = na(ops.deployment_manager?.status, "UNKNOWN");

  return {
    runtime,
    security,
    website,
    notifications,
    timeline,
    event_bus,
    deployment,
    overall_health: overallHealth([
      runtime,
      security,
      website,
      notifications,
      timeline,
      event_bus,
      deployment,
    ]),
  };
}

export function aggregateTodaysWork(): TodaysWorkSection {
  const state = readJsonSafe<{
    pending_actions?: string[];
    latest_founder_review?: string;
    discovery?: { publication_queue?: unknown[] };
  }>("SOS/project-state.json");
  const dash = readJsonSafe<{
    factory_health?: {
      templates_ready_to_publish?: number;
      templates_waiting_founder?: number;
    };
  }>("SOS/07_LOGS/saios/production-dashboard/dashboard.json");
  const timeline = readJsonSafe<{
    pending_founder_reviews?: string[];
    pending_publication?: number;
  }>("SOS/07_LOGS/saios/timeline-department/timeline-state.json");
  const notif = readJsonSafe<{
    alerts_collected?: number;
  }>("SOS/07_LOGS/saios/notification-department/notification-ledger-summary.json");
  // fallback from ops
  const opsNotif = readJsonSafe<{
    operations?: { notification_department?: { alerts_collected?: number } };
  }>("SOS/project-state.json");

  const pendingApprovals =
    timeline.data?.pending_founder_reviews ??
    (state.data?.pending_actions ?? []).filter((a) => /founder/i.test(a));

  return {
    templates_generated_today: "see production dashboard (batch totals)",
    templates_reviewed_today: dash.data?.factory_health?.templates_waiting_founder ?? 0,
    templates_published_today: state.data?.latest_founder_review ? "latest release recorded" : "n/a",
    pending_founder_approvals: pendingApprovals,
    pending_releases:
      timeline.data?.pending_publication ??
      dash.data?.factory_health?.templates_ready_to_publish ??
      state.data?.discovery?.publication_queue?.length ??
      "n/a",
    pending_notifications:
      notif.data?.alerts_collected ??
      opsNotif.data?.operations?.notification_department?.alerts_collected ??
      "n/a",
  };
}

export function aggregateResumeFactory(): ResumeFactorySection {
  const state = readJsonSafe<{
    latest_batch?: string;
    latest_generation?: string;
    latest_template?: string;
    competitive_validation_status?: string;
  }>("SOS/project-state.json");
  const dash = readJsonSafe<{
    factory_health?: {
      templates_generated?: number;
      templates_published?: number;
      templates_ready_to_publish?: number;
      current_batch?: string;
    };
    batch_health?: {
      averages?: { competitive_score?: number; confidence?: number };
    };
  }>("SOS/07_LOGS/saios/production-dashboard/dashboard.json");

  const competitive =
    dash.data?.batch_health?.averages?.competitive_score ??
    state.data?.competitive_validation_status ??
    "n/a";

  return {
    current_batch: na(
      dash.data?.factory_health?.current_batch ?? state.data?.latest_batch,
    ),
    templates_generated: dash.data?.factory_health?.templates_generated ?? "n/a",
    templates_published: dash.data?.factory_health?.templates_published ?? "n/a",
    templates_ready: dash.data?.factory_health?.templates_ready_to_publish ?? "n/a",
    average_quality: dash.data?.batch_health?.averages?.confidence ?? "n/a",
    competitive_score: competitive,
    latest_production: na(
      state.data?.latest_generation ?? state.data?.latest_template,
    ),
  };
}

export function aggregateWebsite(): WebsiteSection {
  const health = readJsonSafe<{
    status?: string;
    checks?: Record<string, boolean>;
  }>("SOS/07_LOGS/saios/website-department/website-health.json");
  const checks = health.data?.checks ?? {};
  const deploy = readJsonSafe<{
    bundle_id?: string;
    status?: string;
  }>("SOS/07_LOGS/saios/deployment-manager/deployment-bundle.json");

  const flag = (key: string) =>
    checks[key] === true ? "PASS" : checks[key] === false ? "FAIL" : "n/a";

  return {
    website_health: na(health.data?.status, "UNKNOWN"),
    runtime_catalog: flag("runtime_catalog_check"),
    gallery: flag("resume_gallery_check"),
    seo: flag("seo_check"),
    editor: flag("editor_check"),
    download_flow: flag("download_flow_check"),
    latest_deployment: na(deploy.data?.bundle_id ?? deploy.data?.status),
  };
}

export function aggregateSecurity(): SecuritySection {
  const health = readJsonSafe<{
    security_level?: string;
    status?: string;
  }>("SOS/07_LOGS/saios/security-department/security-health.json");
  const risks = readJsonSafe<{
    risks?: Array<{ title?: string; level?: string }>;
  }>("SOS/07_LOGS/saios/security-department/security-risks.json");
  const summary = readTextSafe(
    "SOS/07_LOGS/saios/security-department/security-summary.md",
    800,
  );

  const riskTitles = (risks.data?.risks ?? [])
    .filter((r) => String(r.level).toUpperCase() !== "GREEN")
    .slice(0, 8)
    .map((r) => `[${r.level}] ${r.title}`);

  const diskMatch = summary.match(/Disk usage[^\n]*/i);
  const envMatch = /placeholder|environment/i.test(summary)
    ? "placeholders / dry-run noted"
    : "ok";

  return {
    security_level: na(health.data?.security_level ?? health.data?.status),
    current_risks: riskTitles.length ? riskTitles : ["none elevated"],
    disk: diskMatch?.[0] ?? "see security-summary",
    environment: envMatch,
    runtime_protection: na(health.data?.status, "see security-health"),
    backup_status: /rollback|snapshot/i.test(summary)
      ? "rollback/snapshot metadata present"
      : "see security backup checks",
  };
}

export function aggregateTimeline(): TimelineSection {
  const state = readJsonSafe<{
    sprint?: { id?: string; label?: string; day_index?: number };
    clock?: { date?: string };
    milestones?: Array<{ title?: string; status?: string }>;
    deadlines?: Array<{ title?: string; status?: string }>;
  }>("SOS/07_LOGS/saios/timeline-department/timeline-state.json");
  const reminders = readJsonSafe<{
    reminders?: Array<{ kind?: string; title?: string }>;
  }>("SOS/07_LOGS/saios/timeline-department/timeline-reminders.json");

  const today = (reminders.data?.reminders ?? [])
    .filter((r) => ["TODAY", "CRITICAL", "OVERDUE"].includes(String(r.kind).toUpperCase()))
    .map((r) => `[${r.kind}] ${r.title}`);

  const upcoming = (state.data?.milestones ?? [])
    .filter((m) => String(m.status).toLowerCase() !== "completed")
    .slice(0, 5)
    .map((m) => String(m.title));

  const overdue = (state.data?.deadlines ?? [])
    .filter((d) => String(d.status).toLowerCase() === "overdue")
    .map((d) => String(d.title));

  return {
    current_sprint: na(
      state.data?.sprint?.label ?? state.data?.sprint?.id,
    ),
    current_day: na(
      state.data?.sprint?.day_index != null
        ? `day ${state.data.sprint.day_index} · ${state.data.clock?.date ?? ""}`
        : state.data?.clock?.date,
    ),
    todays_reminders: today.length ? today : ["none"],
    upcoming_milestones: upcoming.length ? upcoming : ["none open"],
    overdue_items: overdue.length ? overdue : ["none"],
  };
}

export function aggregateNotifications(): NotificationSection {
  const sources = readJsonSafe<{
    sources?: Array<{ alerts?: unknown[] }>;
  }>("SOS/07_LOGS/saios/notification-department/notification-sources.json");
  const digest = readJsonSafe<{
    structured?: { alerts?: Array<{ priority?: string }> };
  }>("SOS/07_LOGS/saios/notification-department/notification-digest.json");
  const ops = readJsonSafe<{
    operations?: { notification_department?: { alerts_collected?: number } };
  }>("SOS/project-state.json");

  const alerts = digest.data?.structured?.alerts ?? [];
  const critical = alerts.filter((a) => String(a.priority).toUpperCase() === "CRITICAL").length;
  const warnings = alerts.filter((a) => String(a.priority).toUpperCase() === "WARNING").length;
  const collected =
    ops.data?.operations?.notification_department?.alerts_collected ??
    alerts.length;

  return {
    unread_alerts: collected,
    critical_alerts: critical,
    warnings,
    morning_digest: readTextSafe(
      "SOS/07_LOGS/saios/notification-department/morning-digest.md",
      300,
    ),
    evening_digest: readTextSafe(
      "SOS/07_LOGS/saios/notification-department/evening-digest.md",
      300,
    ),
  };
}

export function aggregateReleases(): ReleaseSection {
  const state = readJsonSafe<{
    latest_release?: string;
    latest_catalog?: string;
    pending_actions?: string[];
    discovery?: {
      releases?: Array<{
        release_id?: string;
        status?: string;
        rollback_available?: boolean;
      }>;
    };
    operations?: {
      catalog_integrity?: {
        conflicts_detected?: number;
        safe_to_publish?: boolean;
        next_available_catalog_id?: string;
      };
    };
  }>("SOS/project-state.json");

  const releases = state.data?.discovery?.releases ?? [];
  const withRollback = releases.filter((r) => r.rollback_available).length;
  const cat = state.data?.operations?.catalog_integrity;
  const readyLine = (state.data?.pending_actions ?? []).find((a) =>
    /ready_to_publish|publish/i.test(a),
  );

  return {
    latest_release: na(state.data?.latest_release),
    next_release_candidate: na(
      readyLine ??
        (cat?.next_available_catalog_id
          ? `next catalog id ${cat.next_available_catalog_id}`
          : state.data?.latest_catalog),
    ),
    rollback_availability:
      withRollback > 0
        ? `${withRollback} release(s) rollback_available`
        : "see discovery.releases",
    catalog_integrity: cat
      ? `conflicts=${cat.conflicts_detected ?? "?"}; safe_to_publish=${cat.safe_to_publish}`
      : "n/a",
  };
}

export function aggregatePerformance(): PerformanceSection {
  const dash = readJsonSafe<{
    factory_health?: {
      templates_generated?: number;
      templates_published?: number;
      templates_ready_to_publish?: number;
    };
  }>("SOS/07_LOGS/saios/production-dashboard/dashboard.json");
  const runtime = readJsonSafe<{
    status?: string;
    department_count?: number;
    started_at?: string;
  }>("SOS/07_LOGS/saios/runtime-manager/runtime-state.json");
  const heartbeat = readJsonSafe<{
    generated_at?: string;
    running_services?: string[];
  }>("SOS/07_LOGS/saios/runtime-manager/runtime-heartbeat.json");
  const health = readJsonSafe<{
    departments?: unknown[];
  }>("SOS/07_LOGS/saios/runtime-manager/runtime-health.json");

  return {
    templates_tracked: dash.data?.factory_health?.templates_generated ?? "n/a",
    published: dash.data?.factory_health?.templates_published ?? "n/a",
    ready: dash.data?.factory_health?.templates_ready_to_publish ?? "n/a",
    runtime_uptime: na(
      runtime.data?.started_at
        ? `since ${runtime.data.started_at}`
        : runtime.data?.status,
    ),
    heartbeat: na(heartbeat.data?.generated_at, "missing"),
    department_count:
      runtime.data?.department_count ??
      health.data?.departments?.length ??
      "n/a",
  };
}

export function buildFounderDashboard(generatedAt: string): {
  dashboard: FounderDashboard;
  action_queue: FounderAction[];
} {
  const ai_os_status = aggregateAiOsStatus();
  const todays_work = aggregateTodaysWork();
  const resume_factory = aggregateResumeFactory();
  const website = aggregateWebsite();
  const security = aggregateSecurity();
  const timeline = aggregateTimeline();
  const notifications = aggregateNotifications();
  const releases = aggregateReleases();
  const performance = aggregatePerformance();

  const action_queue = buildActionQueue({
    ai_os_status,
    todays_work,
    security,
    timeline,
    releases,
    notifications,
  });
  const recommended_next_action = recommendNextAction(action_queue);

  return {
    action_queue,
    dashboard: {
      generated_at: generatedAt,
      ai_os_status,
      todays_work,
      resume_factory,
      website,
      security,
      timeline,
      notifications,
      releases,
      performance,
      action_queue,
      recommended_next_action,
    },
  };
}
