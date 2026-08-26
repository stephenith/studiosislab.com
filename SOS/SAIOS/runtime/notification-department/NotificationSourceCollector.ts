/**
 * Collects alert sources across AI OS departments.
 * Missing sources are marked unavailable — never fails the department.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CollectedSource, NormalizedAlert, NotificationPriority, NotificationType } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const LOGS = join(REPO_ROOT, "SOS/07_LOGS/saios");

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function alert(
  id: string,
  source: string,
  type: NotificationType,
  priority: NotificationPriority,
  title: string,
  message: string,
  evidence?: Record<string, unknown>,
): NormalizedAlert {
  return {
    id,
    source,
    type,
    priority,
    title,
    message,
    created_at: new Date().toISOString(),
    evidence,
  };
}

export function collectNotificationSources(): CollectedSource[] {
  const sources: CollectedSource[] = [];

  // Website alerts
  {
    const path = join(LOGS, "website-department/website-alerts.json");
    const data = readJson<{ alerts?: Array<Record<string, unknown>> }>(path);
    if (!data) {
      sources.push({
        id: "website-alerts",
        path,
        status: "unavailable",
        summary: "Website alerts file missing",
        alerts: [],
      });
    } else {
      const alerts = (data.alerts ?? []).map((a, i) =>
        alert(
          String(a.id ?? `website-${i}`),
          "website-department",
          "WEBSITE_ALERT",
          (String(a.severity ?? "info").toUpperCase() === "CRITICAL"
            ? "CRITICAL"
            : String(a.severity ?? "").toUpperCase() === "WARNING"
              ? "WARNING"
              : "INFO") as NotificationPriority,
          String(a.title ?? "Website alert"),
          String(a.message ?? ""),
          a,
        ),
      );
      sources.push({
        id: "website-alerts",
        path,
        status: "available",
        summary: `${alerts.length} website alert(s)`,
        alerts,
        metrics: { alert_count: alerts.length },
      });
    }
  }

  // Production dashboard
  {
    const path = join(LOGS, "production-dashboard/dashboard.json");
    const data = readJson<{
      factory_health?: {
        status?: string;
        templates_ready_to_publish?: number;
        templates_waiting_founder?: number;
        issues_detected?: number;
      };
      issues?: string[];
    }>(path);
    if (!data) {
      sources.push({
        id: "production-dashboard",
        path,
        status: "unavailable",
        summary: "Production dashboard missing",
        alerts: [],
      });
    } else {
      const fh = data.factory_health ?? {};
      const alerts: NormalizedAlert[] = [];
      if ((fh.issues_detected ?? 0) > 0 || (data.issues?.length ?? 0) > 0) {
        alerts.push(
          alert(
            "factory-dashboard-issues",
            "production-dashboard",
            "FACTORY_ALERT",
            "WARNING",
            "Production dashboard issues detected",
            `${fh.issues_detected ?? data.issues?.length ?? 0} issue(s); health=${fh.status ?? "unknown"}`,
            { factory_health: fh, issues: data.issues?.slice(0, 10) },
          ),
        );
      }
      sources.push({
        id: "production-dashboard",
        path,
        status: "available",
        summary: `Factory health ${fh.status ?? "unknown"}`,
        alerts,
        metrics: {
          status: fh.status,
          ready_to_publish: fh.templates_ready_to_publish ?? 0,
          waiting_founder: fh.templates_waiting_founder ?? 0,
        },
      });
    }
  }

  // Factory health
  {
    const path = join(LOGS, "production-dashboard/factory-health.json");
    const data = readJson<Record<string, unknown>>(path);
    if (!data) {
      sources.push({
        id: "factory-health",
        path,
        status: "unavailable",
        summary: "Factory health file missing",
        alerts: [],
      });
    } else {
      const status = String(data.status ?? "unknown");
      const alerts: NormalizedAlert[] = [];
      if (status === "degraded" || status === "attention_required") {
        alerts.push(
          alert(
            "factory-health-attention",
            "factory-health",
            "FACTORY_ALERT",
            "WARNING",
            "Factory health needs attention",
            `Status: ${status}`,
            data,
          ),
        );
      }
      sources.push({
        id: "factory-health",
        path,
        status: "available",
        summary: `status=${status}`,
        alerts,
        metrics: data,
      });
    }
  }

  // Catalog integrity
  {
    const path = join(LOGS, "catalog-integrity/catalog-conflicts.json");
    const data = readJson<{ conflicts?: Array<Record<string, unknown>> }>(path);
    if (!data) {
      sources.push({
        id: "catalog-conflicts",
        path,
        status: "unavailable",
        summary: "Catalog conflicts file missing",
        alerts: [],
      });
    } else {
      const conflicts = data.conflicts ?? [];
      const alerts = conflicts.map((c, i) =>
        alert(
          `catalog-conflict-${i}`,
          "catalog-integrity",
          "FACTORY_ALERT",
          String(c.severity) === "critical" ? "CRITICAL" : "WARNING",
          `Catalog conflict: ${String(c.type ?? "unknown")}`,
          `${String(c.value ?? "")} — ${String(c.recommended_action ?? "review")}`,
          c,
        ),
      );
      sources.push({
        id: "catalog-conflicts",
        path,
        status: "available",
        summary: `${conflicts.length} conflict(s)`,
        alerts,
        metrics: { conflict_count: conflicts.length },
      });
    }
  }

  // Scheduler health
  {
    const path = join(LOGS, "scheduler/scheduler-health.json");
    const data = readJson<Record<string, unknown>>(path);
    if (!data) {
      sources.push({
        id: "scheduler-health",
        path,
        status: "unavailable",
        summary: "Scheduler health file missing",
        alerts: [],
      });
    } else {
      const status = String(data.status ?? data.health ?? "unknown");
      const alerts: NormalizedAlert[] = [];
      if (["stopped", "failed", "unhealthy", "interrupted"].includes(status.toLowerCase())) {
        alerts.push(
          alert(
            "scheduler-stopped",
            "scheduler",
            "FACTORY_ALERT",
            "CRITICAL",
            "Scheduler stopped or unhealthy",
            `Scheduler status: ${status}`,
            data,
          ),
        );
      }
      sources.push({
        id: "scheduler-health",
        path,
        status: "available",
        summary: `status=${status}`,
        alerts,
        metrics: data,
      });
    }
  }

  // Project state
  {
    const path = join(REPO_ROOT, "SOS/project-state.json");
    const data = readJson<{
      pending_actions?: string[];
      latest_release?: string;
      latest_catalog?: string;
      factory_v1?: { status?: string };
      operations?: { website_department?: { status?: string } };
      discovery?: { publication_queue?: unknown[] };
    }>(path);
    if (!data) {
      sources.push({
        id: "project-state",
        path,
        status: "unavailable",
        summary: "Project state missing",
        alerts: [],
      });
    } else {
      const alerts = (data.pending_actions ?? []).map((action, i) =>
        alert(
          `pending-${i}`,
          "project-state",
          action.toLowerCase().includes("founder") ? "TIMELINE_REMINDER" : "FACTORY_ALERT",
          "INFO",
          "Pending action",
          action,
        ),
      );
      sources.push({
        id: "project-state",
        path,
        status: "available",
        summary: `${data.pending_actions?.length ?? 0} pending action(s)`,
        alerts,
        metrics: {
          latest_release: data.latest_release,
          latest_catalog: data.latest_catalog,
          factory_v1: data.factory_v1?.status,
          website_status: data.operations?.website_department?.status,
          publication_queue: data.discovery?.publication_queue?.length ?? 0,
          pending_actions: data.pending_actions ?? [],
        },
      });
    }
  }

  // Security alerts (Agent #107)
  {
    const path = join(LOGS, "security-department/security-alerts.json");
    const data = readJson<{
      alerts?: Array<Record<string, unknown>>;
    }>(path);
    if (!data) {
      sources.push({
        id: "security-alerts",
        path,
        status: "unavailable",
        summary: "Security alerts file missing",
        alerts: [],
      });
    } else {
      const alerts = (data.alerts ?? []).map((a, i) => {
        const level = String(a.level ?? "YELLOW").toUpperCase();
        const priority: NotificationPriority =
          level === "CRITICAL" || level === "RED"
            ? "CRITICAL"
            : level === "GREEN"
              ? "INFO"
              : "WARNING";
        return alert(
          String(a.id ?? `security-${i}`),
          "security-department",
          "FACTORY_ALERT",
          priority,
          String(a.title ?? "Security alert"),
          String(a.message ?? a.detail ?? ""),
          a,
        );
      });
      sources.push({
        id: "security-alerts",
        path,
        status: "available",
        summary: `${alerts.length} security alert(s)`,
        alerts,
        metrics: { alert_count: alerts.length },
      });
    }
  }

  // Timeline reminders (Agent #107)
  {
    const path = join(LOGS, "timeline-department/timeline-reminders.json");
    const data = readJson<{
      reminders?: Array<Record<string, unknown>>;
    }>(path);
    if (!data) {
      sources.push({
        id: "timeline-reminders",
        path,
        status: "unavailable",
        summary: "Timeline reminders file missing",
        alerts: [],
      });
    } else {
      const alerts = (data.reminders ?? []).map((r, i) => {
        const kind = String(r.kind ?? "INFO").toUpperCase();
        const priority: NotificationPriority =
          kind === "CRITICAL" || kind === "OVERDUE" ? "CRITICAL" : "WARNING";
        return alert(
          String(r.id ?? `timeline-${i}`),
          "timeline-department",
          "TIMELINE_REMINDER",
          priority,
          String(r.title ?? "Timeline reminder"),
          String(r.message ?? ""),
          r,
        );
      });
      sources.push({
        id: "timeline-reminders",
        path,
        status: "available",
        summary: `${alerts.length} reminder(s)`,
        alerts,
        metrics: { reminder_count: alerts.length },
      });
    }
  }

  // Event Bus history (Agent #107)
  {
    const path = join(LOGS, "event-bus/event-history.json");
    const data = readJson<{
      events?: Array<Record<string, unknown>>;
      count?: number;
    }>(path);
    if (!data) {
      sources.push({
        id: "event-history",
        path,
        status: "unavailable",
        summary: "Event history file missing",
        alerts: [],
      });
    } else {
      const events = data.events ?? [];
      const critical = events.filter((e) =>
        /CRITICAL|WARNING/i.test(String(e.type ?? "")),
      );
      const alerts = critical.slice(0, 10).map((e, i) =>
        alert(
          String(e.id ?? `event-${i}`),
          "event-bus",
          "FACTORY_ALERT",
          String(e.type).includes("CRITICAL") ? "CRITICAL" : "WARNING",
          `Event Bus: ${String(e.type ?? "event")}`,
          `from ${String(e.source ?? "unknown")}`,
          e,
        ),
      );
      sources.push({
        id: "event-history",
        path,
        status: "available",
        summary: `${events.length} event(s) in history`,
        alerts,
        metrics: { event_count: data.count ?? events.length },
      });
    }
  }

  // Runtime health (Agent #107)
  {
    const path = join(LOGS, "runtime-manager/runtime-health.json");
    const data = readJson<{
      overall?: string;
      departments?: unknown[];
    }>(path);
    if (!data) {
      sources.push({
        id: "runtime-health",
        path,
        status: "unavailable",
        summary: "Runtime health file missing",
        alerts: [],
      });
    } else {
      const overall = String(data.overall ?? "unknown");
      const alerts: NormalizedAlert[] = [];
      if (!["HEALTHY", "OK"].includes(overall.toUpperCase())) {
        alerts.push(
          alert(
            "runtime-health-attention",
            "runtime-manager",
            "FACTORY_ALERT",
            overall.toUpperCase() === "CRITICAL" ? "CRITICAL" : "WARNING",
            `Runtime health: ${overall}`,
            `${data.departments?.length ?? 0} departments reported`,
            data,
          ),
        );
      }
      sources.push({
        id: "runtime-health",
        path,
        status: "available",
        summary: `overall=${overall}`,
        alerts,
        metrics: { overall, department_count: data.departments?.length ?? 0 },
      });
    }
  }

  return sources;
}

export function flattenAlerts(sources: CollectedSource[]): NormalizedAlert[] {
  return sources.flatMap((s) => s.alerts);
}
