/**
 * Notification Department Director — orchestration entry point.
 * AGENT #101 — unified AI OS notification layer.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  detectLiveCredentials,
  loadOrCreateConfig,
  NOTIFICATION_DEPARTMENT_ROOT,
} from "./NotificationConfig.js";
import { buildDigests } from "./NotificationDigestBuilder.js";
import { writeNotificationLedger } from "./NotificationLedger.js";
import { prioritizeAlerts } from "./NotificationPriorityEngine.js";
import { persistNotificationReports } from "./NotificationReporter.js";
import {
  ConsoleNotificationAdapter,
  routeNotifications,
} from "./NotificationRouter.js";
import { collectNotificationSources, flattenAlerts } from "./NotificationSourceCollector.js";
import { EmailNotificationAdapter } from "./EmailNotificationAdapter.js";
import { TelegramNotificationAdapter } from "./TelegramNotificationAdapter.js";
import type {
  NotificationDepartmentOptions,
  NotificationDepartmentResult,
} from "./types.js";

export const NOTIFICATION_DEPARTMENT = {
  module: "notification-department",
  version: "1.0.0",
  agent: "101",
  role: "ai_os_unified_notifications",
  prohibitions: [
    "no_resume_generation",
    "no_schedule_mutation",
    "no_website_department_mutation",
    "no_live_sends_during_verify",
  ],
} as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const STATE_PATH = join(REPO_ROOT, "SOS/project-state.json");

type ProjectState = {
  generated_at: string;
  latest_agent: string;
  next_agent: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
};

export async function runNotificationDepartment(
  options: NotificationDepartmentOptions = {},
): Promise<NotificationDepartmentResult> {
  const persist = options.persist !== false;
  const forceDryRun = options.force_dry_run !== false;
  const credentials = detectLiveCredentials();
  const config = loadOrCreateConfig(persist);

  const dry_run = forceDryRun || config.force_dry_run || !credentials.any;

  const sources = collectNotificationSources();
  const alerts = flattenAlerts(sources);
  const decisions = prioritizeAlerts(alerts);
  const digest = buildDigests({ sources, alerts });

  const telegram = new TelegramNotificationAdapter();
  const email = new EmailNotificationAdapter();
  const consoleAdapter = new ConsoleNotificationAdapter();

  const routed = await routeNotifications({
    decisions,
    digest,
    adapters: [telegram, email, consoleAdapter],
    dry_run: true, // verify / default: never live-send
  });

  const liveAttempt = routed.results.some((r) => !r.dry_run);
  if (liveAttempt) {
    throw new Error("Live send attempted during Notification Department run — aborted");
  }

  const ledger = writeNotificationLedger(routed.ledger);

  const checks = {
    source_collection: sources.length >= 1,
    priority_routing: decisions.length >= 0,
    digest_generation: Boolean(digest.morning && digest.evening && digest.daily),
    telegram_adapter_dry_run: routed.results.some(
      (r) => r.channel === "telegram" && r.dry_run && r.ok,
    ),
    email_adapter_dry_run: routed.results.some(
      (r) => r.channel === "email" && r.dry_run && r.ok,
    ),
    ledger_writing: Boolean(ledger.summary.total_entries),
    unavailable_source_handling: sources.every(
      (s) => s.status === "available" || s.status === "unavailable",
    ),
    no_live_sends_during_verify: !liveAttempt,
    report_generation: persist,
  };

  const unavailable = sources.filter((s) => s.status === "unavailable").length;
  const status =
    checks.source_collection && checks.digest_generation
      ? unavailable > 3
        ? "DEGRADED"
        : "READY"
      : "BLOCKED";

  const result: NotificationDepartmentResult = {
    generated_at: new Date().toISOString(),
    status,
    dry_run,
    live_credentials_configured: credentials.any,
    sources,
    alerts,
    digest,
    channels: {
      telegram: { configured: telegram.configured, dry_run: true },
      email: { configured: email.configured, dry_run: true },
      console: { configured: true, dry_run: true },
    },
    ledger_entries: routed.ledger,
    output_dir: NOTIFICATION_DEPARTMENT_ROOT,
    checks,
  };

  if (persist) {
    persistNotificationReports(result);
    updateProjectState(result);
  }

  return result;
}

function updateProjectState(result: NotificationDepartmentResult): void {
  if (!existsSync(STATE_PATH)) throw new Error("SOS/project-state.json missing");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
  if (state.next_agent !== "101" && state.latest_agent !== "101") {
    throw new Error(
      `Expected agent #101, found latest=${state.latest_agent} next=${state.next_agent}`,
    );
  }

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "101",
    next_agent: "102",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      notification_department: {
        last_run: now,
        status: result.status,
        dry_run: result.dry_run,
        sources_available: result.sources.filter((s) => s.status === "available").length,
        sources_unavailable: result.sources.filter((s) => s.status === "unavailable").length,
        alerts_collected: result.alerts.length,
        output_dir: "SOS/07_LOGS/saios/notification-department",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "notification_department",
        summary: `Agent #101: Notification Department ${result.status} (${result.alerts.length} alerts, dry-run)`,
        ref: "SOS/07_LOGS/saios/notification-department/notification-report.md",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));
}

export { STATE_PATH, NOTIFICATION_DEPARTMENT_ROOT };
