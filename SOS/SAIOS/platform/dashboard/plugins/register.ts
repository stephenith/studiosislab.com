/**
 * Register dashboard plugins — Agents #174 / #175 / #179.
 * Wave-1: Mission Approval, Runtime Release, System Readiness
 * Wave-2: Queue Admission, Execution Package, Ack, Queue Submission, Shadow Queue, Runtime Plan
 * Wave-3: Execution Controller (scaffold)
 */
import { registerDashboardPlugin } from "../DashboardPlugin.js";
import {
  defaultSnapshotRegistry,
  type SnapshotRegistry,
} from "../SnapshotRegistry.js";
import {
  defaultRouteRegistry,
  type RouteRegistry,
} from "../RouteRegistry.js";
import { SnapshotLoader } from "../SnapshotLoader.js";
import { missionApprovalPlugin } from "./missionApproval.js";
import { runtimeReleasePlugin } from "./runtimeRelease.js";
import { systemReadinessPlugin } from "./systemReadiness.js";
import { queueAdmissionPlugin } from "./queueAdmission.js";
import { executionPackagePlugin } from "./executionPackage.js";
import { executionPackageAckPlugin } from "./executionPackageAck.js";
import { queueSubmissionPlugin } from "./queueSubmission.js";
import { shadowQueuePlugin } from "./shadowQueue.js";
import { runtimePlanPlugin } from "./runtimePlan.js";
import { executionControllerPlugin } from "./executionController.js";
import { departmentRegistryPlugin } from "./departmentRegistry.js";
import { costLedgerPlugin } from "./costLedger.js";
import { workerRuntimePlugin } from "./workerRuntime.js";
import { telemetryRegistryPlugin } from "./telemetryRegistry.js";
import { activationGatePlugin } from "./activationGate.js";
import { executionAuthorizationPlugin } from "./executionAuthorization.js";
import { preDispatchSimulationPlugin } from "./preDispatchSimulation.js";

let registered = false;

export const WAVE1_DASHBOARD_PLUGINS = [
  missionApprovalPlugin,
  runtimeReleasePlugin,
  systemReadinessPlugin,
] as const;

export const WAVE2_DASHBOARD_PLUGINS = [
  queueAdmissionPlugin,
  executionPackagePlugin,
  executionPackageAckPlugin,
  queueSubmissionPlugin,
  shadowQueuePlugin,
  runtimePlanPlugin,
] as const;

export const WAVE3_DASHBOARD_PLUGINS = [executionControllerPlugin] as const;

export const WAVE4_DASHBOARD_PLUGINS = [departmentRegistryPlugin] as const;

export const WAVE5_DASHBOARD_PLUGINS = [costLedgerPlugin] as const;

export const WAVE6_DASHBOARD_PLUGINS = [workerRuntimePlugin] as const;

export const WAVE7_DASHBOARD_PLUGINS = [telemetryRegistryPlugin] as const;

export const WAVE8_DASHBOARD_PLUGINS = [activationGatePlugin] as const;

export const WAVE9_DASHBOARD_PLUGINS = [executionAuthorizationPlugin] as const;

export const WAVE10_DASHBOARD_PLUGINS = [preDispatchSimulationPlugin] as const;

/** All registered dashboard plugins (Wave-1 … Wave-10). */
export const ALL_DASHBOARD_PLUGINS = [
  ...WAVE1_DASHBOARD_PLUGINS,
  ...WAVE2_DASHBOARD_PLUGINS,
  ...WAVE3_DASHBOARD_PLUGINS,
  ...WAVE4_DASHBOARD_PLUGINS,
  ...WAVE5_DASHBOARD_PLUGINS,
  ...WAVE6_DASHBOARD_PLUGINS,
  ...WAVE7_DASHBOARD_PLUGINS,
  ...WAVE8_DASHBOARD_PLUGINS,
  ...WAVE9_DASHBOARD_PLUGINS,
  ...WAVE10_DASHBOARD_PLUGINS,
] as const;

/**
 * Idempotent registration of Wave-1 + Wave-2 dashboard plugins.
 */
export function ensureDashboardPluginsRegistered(opts?: {
  snapshots?: SnapshotRegistry;
  routes?: RouteRegistry;
}): void {
  if (registered && !opts?.snapshots && !opts?.routes) return;
  const snapshots = opts?.snapshots ?? defaultSnapshotRegistry;
  const routes = opts?.routes ?? defaultRouteRegistry;
  if (!opts?.snapshots && !opts?.routes && registered) return;

  for (const plugin of ALL_DASHBOARD_PLUGINS) {
    if (snapshots.get(plugin.id) == null && plugin.snapshot) {
      snapshots.register(plugin.snapshot);
    }
    for (const route of plugin.routes ?? []) {
      if (!routes.list().some((r) => r.id === route.id)) {
        routes.register(route);
      }
    }
  }
  if (!opts?.snapshots && !opts?.routes) registered = true;
}

export function createWave1SnapshotLoader(
  registry: SnapshotRegistry = defaultSnapshotRegistry,
): SnapshotLoader {
  ensureDashboardPluginsRegistered({
    snapshots: registry,
    routes: defaultRouteRegistry,
  });
  return new SnapshotLoader(registry);
}

/** Alias — loader covers all registered snapshot plugins. */
export const createDashboardSnapshotLoader = createWave1SnapshotLoader;

export function registerWave1Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE1_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave2Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE2_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave3Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE3_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave4Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE4_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave5Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE5_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave6Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE6_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave7Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE7_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave8Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE8_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave9Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE9_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerWave10Plugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of WAVE10_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}

export function registerAllDashboardPlugins(
  snapshots: SnapshotRegistry,
  routes: RouteRegistry,
): void {
  for (const plugin of ALL_DASHBOARD_PLUGINS) {
    registerDashboardPlugin(plugin, { snapshots, routes });
  }
}
