/**
 * Founder monitoring — generate actions only; never send notifications.
 */
import { fileAgeMs, readJsonSafe } from "./supervisor-utils.js";
import type { FounderAction, SupervisorConfiguration } from "./types.js";

export function collectFounderActions(
  config: SupervisorConfiguration,
): FounderAction[] {
  const actions: FounderAction[] = [];

  const fcc = readJsonSafe<{
    recommended_next_action?: string;
    overall_health?: string;
  }>("SOS/07_LOGS/saios/founder-control-center/founder-control-center.json");
  const queue = readJsonSafe<{
    actions?: Array<{ title?: string; detail?: string; priority?: string }>;
  }>("SOS/07_LOGS/saios/founder-control-center/founder-action-queue.json");
  const state = readJsonSafe<{
    pending_actions?: string[];
    latest_founder_review?: string;
  }>("SOS/project-state.json");

  const morningAge = fileAgeMs(
    "SOS/07_LOGS/saios/notification-department/morning-digest.md",
  );
  const eveningAge = fileAgeMs(
    "SOS/07_LOGS/saios/notification-department/evening-digest.md",
  );

  if (morningAge != null && morningAge > config.morning_digest_max_age_ms) {
    actions.push({
      id: "morning-digest-overdue",
      priority: "P1",
      title: "Morning digest overdue",
      detail: `age_ms=${morningAge}`,
      source: "notification-department",
      send: false,
    });
  }

  if (eveningAge != null && eveningAge > config.evening_digest_max_age_ms) {
    actions.push({
      id: "evening-digest-overdue",
      priority: "P1",
      title: "Evening digest overdue",
      detail: `age_ms=${eveningAge}`,
      source: "notification-department",
      send: false,
    });
  }

  const fccAge = fileAgeMs(
    "SOS/07_LOGS/saios/founder-control-center/founder-control-center.json",
  );
  if (fccAge != null && fccAge > config.fcc_freshness_ms) {
    actions.push({
      id: "fcc-stale",
      priority: "P2",
      title: "Founder Control Center stale",
      detail: `age_ms=${fccAge}`,
      source: "founder-control-center",
      send: false,
    });
  }

  for (const pending of state.data?.pending_actions ?? []) {
    if (/founder/i.test(pending)) {
      actions.push({
        id: "fr-pending",
        priority: "P0",
        title: "FR review pending",
        detail: pending,
        source: "project-state",
        send: false,
      });
    }
  }

  const security = readJsonSafe<{ security_level?: string }>(
    "SOS/07_LOGS/saios/security-department/security-health.json",
  );
  const sec = String(security.data?.security_level ?? "").toUpperCase();
  if (sec === "CRITICAL" || sec === "RED") {
    actions.push({
      id: "security-critical-founder",
      priority: "P0",
      title: "Security critical",
      detail: sec,
      source: "security-department",
      send: false,
    });
  }

  const website = readJsonSafe<{ status?: string }>(
    "SOS/07_LOGS/saios/website-department/website-health.json",
  );
  const web = String(website.data?.status ?? "").toUpperCase();
  if (web === "DOWN" || web === "CRITICAL") {
    actions.push({
      id: "website-critical-founder",
      priority: "P0",
      title: "Website critical",
      detail: web,
      source: "website-department",
      send: false,
    });
  }

  // Surface top FCC queue item if present
  const top = queue.data?.actions?.[0];
  if (top?.title) {
    actions.push({
      id: "fcc-top-action",
      priority: (top.priority as FounderAction["priority"]) || "P1",
      title: String(top.title),
      detail: String(top.detail ?? fcc.data?.recommended_next_action ?? ""),
      source: "founder-control-center",
      send: false,
    });
  }

  // Dedupe by id
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}
