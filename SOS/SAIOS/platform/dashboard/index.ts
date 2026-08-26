/**
 * Dashboard platform — Agent #174.
 */
export type {
  SnapshotSource,
  SnapshotSourceState,
  SnapshotLoadContext,
} from "./SnapshotSource.js";
export { SnapshotRegistry, defaultSnapshotRegistry } from "./SnapshotRegistry.js";
export { SnapshotLoader } from "./SnapshotLoader.js";
export type {
  DashboardRouteContext,
  RouteMatch,
  DashboardRouteHandler,
} from "./RouteRegistry.js";
export {
  RouteRegistry,
  defaultRouteRegistry,
  exactRoute,
  paramRoute,
} from "./RouteRegistry.js";
export type { DashboardPlugin } from "./DashboardPlugin.js";
export { registerDashboardPlugin } from "./DashboardPlugin.js";
export {
  WAVE1_DASHBOARD_PLUGINS,
  WAVE2_DASHBOARD_PLUGINS,
  WAVE3_DASHBOARD_PLUGINS,
  WAVE4_DASHBOARD_PLUGINS,
  WAVE5_DASHBOARD_PLUGINS,
  WAVE6_DASHBOARD_PLUGINS,
  WAVE7_DASHBOARD_PLUGINS,
  WAVE8_DASHBOARD_PLUGINS,
  WAVE9_DASHBOARD_PLUGINS,
  WAVE10_DASHBOARD_PLUGINS,
  ALL_DASHBOARD_PLUGINS,
  ensureDashboardPluginsRegistered,
  createWave1SnapshotLoader,
  createDashboardSnapshotLoader,
  registerWave1Plugins,
  registerWave2Plugins,
  registerWave3Plugins,
  registerWave4Plugins,
  registerWave5Plugins,
  registerWave6Plugins,
  registerWave7Plugins,
  registerWave8Plugins,
  registerWave9Plugins,
  registerWave10Plugins,
  registerAllDashboardPlugins,
} from "./plugins/register.js";
export { missionApprovalPlugin } from "./plugins/missionApproval.js";
export { runtimeReleasePlugin } from "./plugins/runtimeRelease.js";
export { systemReadinessPlugin } from "./plugins/systemReadiness.js";
export { queueAdmissionPlugin } from "./plugins/queueAdmission.js";
export { executionPackagePlugin } from "./plugins/executionPackage.js";
export { executionPackageAckPlugin } from "./plugins/executionPackageAck.js";
export { queueSubmissionPlugin } from "./plugins/queueSubmission.js";
export { shadowQueuePlugin } from "./plugins/shadowQueue.js";
export { runtimePlanPlugin } from "./plugins/runtimePlan.js";
export { executionControllerPlugin } from "./plugins/executionController.js";
export { departmentRegistryPlugin } from "./plugins/departmentRegistry.js";
export { costLedgerPlugin } from "./plugins/costLedger.js";
export { workerRuntimePlugin } from "./plugins/workerRuntime.js";
export { telemetryRegistryPlugin } from "./plugins/telemetryRegistry.js";
export { activationGatePlugin } from "./plugins/activationGate.js";
export { executionAuthorizationPlugin } from "./plugins/executionAuthorization.js";
export { preDispatchSimulationPlugin } from "./plugins/preDispatchSimulation.js";
