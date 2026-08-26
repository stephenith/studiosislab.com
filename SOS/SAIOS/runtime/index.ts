/**
 * SAIOS Runtime v1.0 — root exports
 *
 * Orchestration skeleton only. No execution logic.
 */

export * from "./shared/index.js";
export * from "./config/index.js";
export * from "./chief/index.js";
export * from "./registry/index.js";
export * from "./queue/index.js";
export * from "./cursor/index.js";
export * from "./qa/index.js";
export * from "./memory/index.js";
export * from "./knowledge/index.js";
export * from "./reporter/index.js";
export * from "./notifications/index.js";
export * from "./logs/index.js";

export * from "./integration/index.js";

export * from "./shadow/index.js";

export { RuntimeLoop } from "./RuntimeLoop.js";
export type { RuntimeLoopOptions } from "./RuntimeLoop.js";
export { RuntimeHeartbeat } from "./RuntimeHeartbeat.js";
export { RuntimeState } from "./RuntimeState.js";
export { RuntimeSupervisor } from "./RuntimeSupervisor.js";
export type { SupervisorIssue, SupervisorResult } from "./RuntimeSupervisor.js";
export { resolveRuntimePaths } from "./runtime-paths.js";
export type {
  RuntimeStatus,
  RuntimeHeartbeatSnapshot,
  RuntimePersistedState,
  RuntimeCycleResult,
  RuntimeRunSummary,
  CursorExecutorLike,
} from "./runtime-types.js";

export const SAIOS_RUNTIME_VERSION = "1.0.0";
