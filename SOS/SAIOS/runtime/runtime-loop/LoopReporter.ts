/**
 * Persist runtime-loop snapshots and reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNTIME_LOOP_ROOT } from "./LoopConfiguration.js";
import type {
  LoopConfiguration,
  RecoveryAttempt,
  RuntimeCycleResult,
  RuntimeLoopResult,
} from "./types.js";

export function writeRuntimeLoopReports(input: {
  result: RuntimeLoopResult;
  config: LoopConfiguration;
  lastCycle: RuntimeCycleResult | null;
  recoveries: RecoveryAttempt[];
  heartbeatAt: string | null;
}): void {
  mkdirSync(RUNTIME_LOOP_ROOT, { recursive: true });
  const { result, config, lastCycle, recoveries, heartbeatAt } = input;
  const at = result.generated_at;

  writeFileSync(
    join(RUNTIME_LOOP_ROOT, "runtime-loop.json"),
    JSON.stringify(
      {
        generated_at: at,
        status: result.status,
        mode: result.mode,
        uptime_ms: result.uptime_ms,
        cycle_count: result.cycle_count,
        department_count: result.departments.length,
        available_count: result.departments.filter((d) => d.available).length,
        checks: result.checks,
        config: {
          runtime_interval_ms: config.runtime_interval_ms,
          dry_run: config.dry_run,
          max_cycles: config.max_cycles,
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(RUNTIME_LOOP_ROOT, "runtime-cycle.json"),
    JSON.stringify(lastCycle, null, 2),
  );

  writeFileSync(
    join(RUNTIME_LOOP_ROOT, "runtime-health.json"),
    JSON.stringify(
      {
        generated_at: at,
        departments: lastCycle?.health ?? [],
        failed: (lastCycle?.health ?? [])
          .filter((h) => h.health === "failed")
          .map((h) => h.id),
        degraded: (lastCycle?.health ?? [])
          .filter((h) => h.health === "degraded")
          .map((h) => h.id),
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(RUNTIME_LOOP_ROOT, "runtime-heartbeat.json"),
    JSON.stringify(
      {
        generated_at: at,
        heartbeat_at: heartbeatAt,
        cycle: lastCycle?.cycle ?? 0,
        running_departments: result.departments
          .filter((d) => d.available)
          .map((d) => d.id),
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(RUNTIME_LOOP_ROOT, "runtime-snapshot.json"),
    JSON.stringify(
      {
        generated_at: at,
        status: result.status,
        mode: result.mode,
        uptime_ms: result.uptime_ms,
        cycle_count: result.cycle_count,
        departments: result.departments,
        last_cycle: lastCycle,
        recoveries,
        reporter: {
          uptime_ms: result.uptime_ms,
          cycle_count: result.cycle_count,
          heartbeat_age_ms: heartbeatAt
            ? Date.now() - Date.parse(heartbeatAt)
            : null,
          running_departments: result.departments
            .filter((d) => d.available)
            .map((d) => d.id),
          failed_departments: (lastCycle?.health ?? [])
            .filter((h) => h.health === "failed")
            .map((h) => h.id),
          recovered_departments: recoveries
            .filter((r) => r.success)
            .map((r) => r.department_id),
          last_recovery: recoveries[recoveries.length - 1] ?? null,
          last_scheduler_tick: lastCycle?.scheduler_tick_at ?? null,
          last_dashboard_refresh: lastCycle?.dashboard_refresh_at ?? null,
          event_count: lastCycle?.events_published ?? 0,
        },
      },
      null,
      2,
    ),
  );

  const report = [
    `# Runtime Loop Report`,
    ``,
    `AI OS continuous orchestration — Agent #109.`,
    `No business logic. Dry-run safe for verify.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Mode | ${result.mode} |`,
    `| Cycles | ${result.cycle_count} |`,
    `| Uptime ms | ${result.uptime_ms} |`,
    `| Departments | ${result.departments.filter((d) => d.available).length}/${result.departments.length} |`,
    `| Recoveries | ${recoveries.length} |`,
    `| Events (last cycle) | ${lastCycle?.events_published ?? 0} |`,
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
    `## Last cycle steps`,
    ``,
    ...(lastCycle?.steps ?? []).map(
      (s) =>
        `${s.step}. ${s.ok ? "✔" : "✘"} **${s.name}** — ${s.detail} (${s.duration_ms}ms)`,
    ),
    ``,
    `## Health`,
    ``,
    ...(lastCycle?.health ?? []).map(
      (h) => `- \`${h.id}\`: ${h.health} — ${h.detail}`,
    ),
    ``,
    `## Recoveries`,
    ``,
    ...(recoveries.length
      ? recoveries.map(
          (r) =>
            `- ${r.at} · ${r.department_id} · ${r.action} · success=${r.success} · ${r.event_published ?? "no-event"}`,
        )
      : ["- none"]),
    ``,
  ].join("\n");

  writeFileSync(join(RUNTIME_LOOP_ROOT, "runtime-report.md"), report);
}
