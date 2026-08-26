/**
 * Priority engine — CRITICAL immediate, WARNING digest unless repeated, INFO digest-only.
 */
import type { NormalizedAlert, NotificationPriority } from "./types.js";

export type RoutingDecision = {
  alert: NormalizedAlert;
  priority: NotificationPriority;
  send_immediately: boolean;
  include_in_digest: boolean;
  reason: string;
};

export function routeAlertPriority(alert: NormalizedAlert): RoutingDecision {
  if (alert.priority === "CRITICAL") {
    return {
      alert,
      priority: "CRITICAL",
      send_immediately: true,
      include_in_digest: true,
      reason: "CRITICAL — send immediately",
    };
  }
  if (alert.priority === "WARNING") {
    return {
      alert,
      priority: "WARNING",
      send_immediately: false,
      include_in_digest: true,
      reason: "WARNING — include in next digest unless repeated",
    };
  }
  return {
    alert,
    priority: "INFO",
    send_immediately: false,
    include_in_digest: true,
    reason: "INFO — digest only",
  };
}

export function prioritizeAlerts(alerts: NormalizedAlert[]): RoutingDecision[] {
  const order: Record<NotificationPriority, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
  };
  return alerts
    .map(routeAlertPriority)
    .sort((a, b) => order[a.priority] - order[b.priority]);
}
