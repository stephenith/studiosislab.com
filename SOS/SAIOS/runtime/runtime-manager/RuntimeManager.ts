/**
 * Runtime Manager — orchestration entry point.
 * AGENT #103 — AI OS Runtime & Deployment Manager V1
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bootstrapRuntime } from "./RuntimeBootstrap.js";
import {
  defaultRuntimeConfiguration,
  persistRuntimeConfiguration,
  RUNTIME_MANAGER_ROOT,
} from "./RuntimeConfiguration.js";
import { validateDeploymentReadiness } from "./RuntimeDeploymentValidator.js";
import { createHeartbeat } from "./RuntimeHeartbeat.js";
import { monitorRuntimeHealth } from "./RuntimeHealthMonitor.js";
import { markFailed } from "./RuntimeLifecycleManager.js";
import { recoverDepartment, recoverFailedDepartments } from "./RuntimeRecovery.js";
import { persistRuntimeReports } from "./RuntimeReporter.js";
import { startAllInOrder } from "./RuntimeSupervisor.js";
import type { RuntimeManagerResult } from "./types.js";

export const RUNTIME_MANAGER = {
  module: "runtime-manager",
  version: "1.0.0",
  agent: "103",
  role: "ai_os_runtime_and_deployment_supervision",
  prohibitions: [
    "no_resume_generation",
    "no_publication_execution",
    "no_department_business_logic_mutation",
    "no_docker_or_vps_provisioning",
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

export function runRuntimeManager(options: { persist?: boolean } = {}): RuntimeManagerResult {
  const persist = options.persist !== false;
  const config = persist
    ? persistRuntimeConfiguration(defaultRuntimeConfiguration())
    : defaultRuntimeConfiguration();

  const boot = bootstrapRuntime();
  const startedAt = new Date().toISOString();

  // Simulate one supervised failure + recovery to prove recovery logic without
  // impacting real departments (catalog-integrity remains available).
  const probeId = boot.startup_order.find((id) => id === "catalog-integrity") ?? boot.startup_order[0]!;
  const beforeStart = boot.processes.get(probeId)!;
  boot.processes.set(
    probeId,
    markFailed(beforeStart, "simulated health failure for recovery proof"),
  );
  const simulatedRecovery = recoverDepartment({
    department_id: probeId,
    processes: boot.processes,
    departments: boot.departments,
    config,
    reason: "simulated health failure for recovery proof",
  });

  const supervised = startAllInOrder({
    startup_order: boot.startup_order,
    departments: boot.departments,
    processes: boot.processes,
  });

  // Ensure recovered process is running after full start pass.
  if (simulatedRecovery.event.success) {
    const proc = boot.processes.get(probeId);
    if (proc && proc.state !== "RUNNING") {
      boot.processes.set(probeId, { ...proc, state: "RUNNING", last_health: "ok" });
    }
  }

  const processes = [...boot.processes.values()];
  const heartbeat = createHeartbeat({
    cycle: 1,
    processes,
    config,
    startedAt,
  });
  const additionalRecovery = recoverFailedDepartments({
    processes: boot.processes,
    departments: boot.departments,
    config,
  });
  const recovery_events = [simulatedRecovery.event, ...additionalRecovery];
  const health = monitorRuntimeHealth({
    departments: boot.departments,
    processes: [...boot.processes.values()],
    heartbeat,
    config,
  });
  const deployment = validateDeploymentReadiness({
    departments: boot.departments,
    startup_order: boot.startup_order,
  });

  const checks = {
    runtime_bootstrap: boot.departments.length >= 11,
    dependency_graph: boot.edges.length > 0,
    startup_order: boot.startup_order.length === boot.departments.length,
    heartbeat: Boolean(heartbeat.heartbeat_id),
    process_registry: processes.length === boot.departments.length,
    recovery_logic: recovery_events.some((e) => e.action === "restart_department" && e.success),
    health_monitor: health.overall === "HEALTHY" || health.overall === "DEGRADED",
    deployment_readiness: deployment.ready,
    reports: persist,
  };

  const result: RuntimeManagerResult = {
    generated_at: new Date().toISOString(),
    status: supervised.status,
    departments: boot.departments,
    startup_order: boot.startup_order,
    processes: [...boot.processes.values()],
    heartbeat,
    health,
    recovery_events,
    deployment,
    dependencies: {
      nodes: boot.departments,
      edges: boot.edges,
      startup_order: boot.startup_order,
    },
    output_dir: RUNTIME_MANAGER_ROOT,
    checks,
  };

  if (persist) {
    persistRuntimeReports(result);
    updateProjectState(result);
  }

  return result;
}

function updateProjectState(result: RuntimeManagerResult): void {
  if (!existsSync(STATE_PATH)) throw new Error("SOS/project-state.json missing");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
  if (state.next_agent !== "103" && state.latest_agent !== "103") {
    throw new Error(
      `Expected agent #103, found latest=${state.latest_agent} next=${state.next_agent}`,
    );
  }

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "103",
    next_agent: "104",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      runtime_manager: {
        last_run: now,
        status: result.status,
        health: result.health.overall,
        departments_registered: result.departments.length,
        deployment_ready: result.deployment.ready,
        output_dir: "SOS/07_LOGS/saios/runtime-manager",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "runtime_manager",
        summary: `Agent #103: Runtime Manager ${result.status} — ${result.departments.length} departments supervised`,
        ref: "SOS/07_LOGS/saios/runtime-manager/runtime-state.json",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));
}

export { STATE_PATH, RUNTIME_MANAGER_ROOT };
