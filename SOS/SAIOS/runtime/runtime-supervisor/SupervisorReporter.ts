/**
 * Persist supervisor reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SUPERVISOR_ROOT } from "./SupervisorConfiguration.js";
import type { HealthSnapshot } from "./HealthSupervisor.js";
import type { SupervisorResult } from "./types.js";
import type { WatchdogResult } from "./Watchdog.js";

export function writeSupervisorReports(input: {
  result: SupervisorResult;
  health: HealthSnapshot;
  watchdog: WatchdogResult;
}): void {
  const { result, health, watchdog } = input;
  mkdirSync(SUPERVISOR_ROOT, { recursive: true });

  writeFileSync(
    join(SUPERVISOR_ROOT, "supervisor-health.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        mode: result.mode,
        heartbeat: result.heartbeat,
        health,
        failures: result.failures,
        checks: result.checks,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(SUPERVISOR_ROOT, "watchdog.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        ...watchdog,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(SUPERVISOR_ROOT, "restart-history.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        restarts: result.restarts,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(SUPERVISOR_ROOT, "recovery-history.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        recoveries: result.recoveries,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(SUPERVISOR_ROOT, "runtime-status.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        mode: result.mode,
        loop_supervised: result.loop_supervised,
        heartbeat: result.heartbeat,
        health,
        events_published: result.events_published,
        founder_actions: result.founder_actions,
      },
      null,
      2,
    ),
  );

  const report = [
    `# Runtime Supervisor Report`,
    ``,
    `AI OS Supervisor & Watchdog — Agent #110.`,
    `Parent orchestration for Runtime Loop. Dry-run safe.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Mode | ${result.mode} |`,
    `| Loop supervised | ${result.loop_supervised} |`,
    `| Heartbeat stale | ${result.heartbeat.stale} |`,
    `| Failures | ${result.failures.length} |`,
    `| Restarts | ${result.restarts.length} |`,
    `| Recoveries | ${result.recoveries.length} |`,
    `| Founder actions | ${result.founder_actions.length} |`,
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
    `## Watchdog`,
    ``,
    `- Triggered: ${watchdog.triggered}`,
    `- Detail: ${watchdog.detail}`,
    `- Events: ${watchdog.events_published.join(", ") || "none"}`,
    ``,
    `## Failures`,
    ``,
    ...(result.failures.length
      ? result.failures.map(
          (f) => `- [${f.severity}] ${f.title} — ${f.detail}`,
        )
      : ["- none"]),
    ``,
    `## Founder actions (not sent)`,
    ``,
    ...(result.founder_actions.length
      ? result.founder_actions.map(
          (a) => `- [${a.priority}] **${a.title}** — ${a.detail} (send=false)`,
        )
      : ["- none"]),
    ``,
    `## Recoveries`,
    ``,
    ...(result.recoveries.length
      ? result.recoveries.map(
          (r) =>
            `- ${r.at} · ${r.action} · success=${r.success} · dry_run=${r.dry_run}`,
        )
      : ["- none"]),
    ``,
  ].join("\n");

  writeFileSync(join(SUPERVISOR_ROOT, "supervisor-report.md"), report);
}
