#!/usr/bin/env tsx
/**
 * Runtime Manager verification.
 * AGENT #103
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runRuntimeManager,
  RUNTIME_MANAGER,
  RUNTIME_MANAGER_ROOT,
  STATE_PATH,
} from "./RuntimeManager.js";
import { bootstrapRuntime } from "./RuntimeBootstrap.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(RUNTIME_MANAGER.module === "runtime-manager", "module id");
  assert(RUNTIME_MANAGER.agent === "103", "agent number");

  const preState = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    next_agent: string;
    latest_agent: string;
    factory_version: string;
    factory_v1?: { status?: string };
    operations?: {
      website_department?: { status?: string };
      notification_department?: { status?: string };
      timeline_department?: { status?: string };
    };
  };

  assert(
    preState.next_agent === "103" || preState.latest_agent === "103",
    "pre-flight: expected agent #103",
  );
  assert(preState.latest_agent === "102" || preState.latest_agent === "103", "latest was #102");
  assert(preState.factory_version === "1.5.0", "factory version");
  assert(preState.factory_v1?.status === "STABLE", "factory STABLE");
  assert(preState.operations?.notification_department?.status === "READY", "notification READY");
  assert(preState.operations?.timeline_department?.status === "READY", "timeline READY");
  assert(Boolean(preState.operations?.website_department?.status), "website present");

  const boot = bootstrapRuntime();
  assert(boot.departments.length >= 11, "runtime bootstrap discovery");
  assert(boot.startup_order[0] === "factory-state", "startup begins with factory-state");
  assert(boot.edges.length > 0, "dependency graph");

  const result = runRuntimeManager({ persist: true });

  const required = [
    "runtime-state.json",
    "runtime-health.json",
    "runtime-heartbeat.json",
    "runtime-dependencies.json",
    "runtime-processes.json",
    "runtime-recovery.json",
    "deployment-readiness.json",
    "runtime-report.md",
  ];
  for (const file of required) {
    assert(existsSync(join(RUNTIME_MANAGER_ROOT, file)), `report: ${file}`);
  }

  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    latest_agent: string;
    next_agent: string;
    operations: { runtime_manager: Record<string, unknown> };
  };
  assert(saved.latest_agent === "103", "latest_agent");
  assert(saved.next_agent === "104", "next_agent");
  assert(saved.operations.runtime_manager?.last_run, "operations.runtime_manager");

  assert(result.checks.runtime_bootstrap, "runtime bootstrap");
  assert(result.checks.dependency_graph, "dependency graph");
  assert(result.checks.startup_order, "startup order");
  assert(result.checks.heartbeat, "heartbeat");
  assert(result.checks.process_registry, "process registry");
  assert(result.checks.recovery_logic, "recovery logic");
  assert(result.checks.health_monitor, "health monitor");
  assert(result.checks.deployment_readiness, "deployment readiness");
  assert(result.checks.reports, "reports");
  assert(result.departments.every((d) => d.registered), "all registered");
  assert(result.departments.every((d) => d.available), "all available");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "runtime-manager",
        agent: "103",
        status: result.status,
        health: result.health.overall,
        departments_registered: result.departments.length,
        startup_order: result.startup_order,
        deployment_ready: result.deployment.ready,
        recovery_events: result.recovery_events.length,
        checks: result.checks,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main();
