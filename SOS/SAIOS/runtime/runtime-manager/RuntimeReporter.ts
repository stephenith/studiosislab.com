/**
 * Persists Runtime Manager reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNTIME_MANAGER_ROOT } from "./RuntimeConfiguration.js";
import type { RuntimeManagerResult } from "./types.js";

export function renderRuntimeReport(result: RuntimeManagerResult): string {
  return [
    "# AI OS Runtime Manager Report",
    "",
    `**Generated:** ${result.generated_at}`,
    `**Status:** ${result.status}`,
    `**Health:** ${result.health.overall}`,
    `**Deployment ready:** ${result.deployment.ready}`,
    "",
    "## Registered departments",
    "",
    ...result.departments.map(
      (d) =>
        `- **${d.label}** (\`${d.id}\`) — available=${d.available} · depends_on=[${d.depends_on.join(", ")}]`,
    ),
    "",
    "## Startup order",
    "",
    ...result.startup_order.map((id, i) => `${i + 1}. ${id}`),
    "",
    "## Heartbeat",
    "",
    `- id: ${result.heartbeat.heartbeat_id}`,
    `- cycle: ${result.heartbeat.cycle}`,
    `- running: ${result.heartbeat.running_services.length}`,
    `- failed: ${result.heartbeat.failed_services.length}`,
    `- memory_mb: ${result.heartbeat.memory_estimate_mb ?? "n/a"}`,
    "",
    "## Recovery events",
    "",
    ...(result.recovery_events.length
      ? result.recovery_events.map(
          (e) =>
            `- ${e.at} — ${e.action} ${e.department_id}: ${e.reason} (${e.success ? "ok" : "fail"})`,
        )
      : ["- None"]),
    "",
    "## Deployment readiness",
    "",
    ...Object.entries(result.deployment.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    "",
    ...result.deployment.notes.map((n) => `> ${n}`),
    "",
  ].join("\n");
}

export function persistRuntimeReports(result: RuntimeManagerResult): string[] {
  mkdirSync(RUNTIME_MANAGER_ROOT, { recursive: true });
  const files = {
    state: join(RUNTIME_MANAGER_ROOT, "runtime-state.json"),
    health: join(RUNTIME_MANAGER_ROOT, "runtime-health.json"),
    heartbeat: join(RUNTIME_MANAGER_ROOT, "runtime-heartbeat.json"),
    dependencies: join(RUNTIME_MANAGER_ROOT, "runtime-dependencies.json"),
    processes: join(RUNTIME_MANAGER_ROOT, "runtime-processes.json"),
    recovery: join(RUNTIME_MANAGER_ROOT, "runtime-recovery.json"),
    deployment: join(RUNTIME_MANAGER_ROOT, "deployment-readiness.json"),
    report: join(RUNTIME_MANAGER_ROOT, "runtime-report.md"),
  };

  writeFileSync(
    files.state,
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        startup_order: result.startup_order,
        department_count: result.departments.length,
      },
      null,
      2,
    ),
  );
  writeFileSync(files.health, JSON.stringify(result.health, null, 2));
  writeFileSync(files.heartbeat, JSON.stringify(result.heartbeat, null, 2));
  writeFileSync(files.dependencies, JSON.stringify(result.dependencies, null, 2));
  writeFileSync(
    files.processes,
    JSON.stringify({ generated_at: result.generated_at, processes: result.processes }, null, 2),
  );
  writeFileSync(
    files.recovery,
    JSON.stringify(
      { generated_at: result.generated_at, events: result.recovery_events },
      null,
      2,
    ),
  );
  writeFileSync(files.deployment, JSON.stringify(result.deployment, null, 2));
  writeFileSync(files.report, renderRuntimeReport(result));
  return Object.values(files);
}
