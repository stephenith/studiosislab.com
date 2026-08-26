#!/usr/bin/env tsx
/**
 * Notification Department verification.
 * AGENT #101
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOTIFICATION_DEPARTMENT,
  NOTIFICATION_DEPARTMENT_ROOT,
  runNotificationDepartment,
  STATE_PATH,
} from "./NotificationDepartmentDirector.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(NOTIFICATION_DEPARTMENT.module === "notification-department", "module id");
  assert(NOTIFICATION_DEPARTMENT.agent === "101", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    factory_v1?: { status?: string };
    operations?: { website_department?: { status?: string } };
    latest_catalog: string;
    latest_release: string;
  };
  assert(
    preState.next_agent === "101" || preState.latest_agent === "101",
    "pre-flight: expected agent #101",
  );
  assert(preState.latest_agent === "100" || preState.latest_agent === "101", "latest agent was #100");
  assert(preState.factory_v1?.status === "STABLE", "factory v1 locked");
  assert(
    preState.operations?.website_department?.status === "HEALTHY" ||
      existsSync(join(NOTIFICATION_DEPARTMENT_ROOT, "../website-department/website-health.json")),
    "website department status present",
  );

  const result = await runNotificationDepartment({
    force_dry_run: true,
    persist: true,
  });

  const required = [
    "notification-config.json",
    "notification-sources.json",
    "notification-digest.json",
    "morning-digest.md",
    "evening-digest.md",
    "daily-summary.md",
    "notification-ledger.jsonl",
    "notification-ledger-summary.json",
    "notification-report.md",
  ];
  for (const file of required) {
    assert(existsSync(join(NOTIFICATION_DEPARTMENT_ROOT, file)), `artifact: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { notification_department: Record<string, unknown> };
  };
  assert(saved.latest_agent === "101", "latest_agent");
  assert(saved.next_agent === "102", "next_agent");
  assert(saved.operations.notification_department?.last_run, "operations.notification_department");

  assert(result.checks.source_collection, "source collection");
  assert(result.checks.priority_routing, "priority routing");
  assert(result.checks.digest_generation, "digest generation");
  assert(result.checks.telegram_adapter_dry_run, "telegram adapter dry-run");
  assert(result.checks.email_adapter_dry_run, "email adapter dry-run");
  assert(result.checks.ledger_writing, "ledger writing");
  assert(result.checks.unavailable_source_handling, "unavailable source handling");
  assert(result.checks.no_live_sends_during_verify, "no live sends during verify");
  assert(result.checks.report_generation, "report generation");
  assert(result.ledger_entries.every((e) => e.status === "dry_run" || e.status === "skipped"), "all ledger dry-run");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "notification-department",
        agent: "101",
        status: result.status,
        dry_run: result.dry_run,
        sources_available: result.sources.filter((s) => s.status === "available").length,
        sources_unavailable: result.sources.filter((s) => s.status === "unavailable").length,
        alerts: result.alerts.length,
        channels: result.channels,
        ledger_batch: result.ledger_entries.length,
        checks: result.checks,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
