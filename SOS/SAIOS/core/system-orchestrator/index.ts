/**
 * Canonical System Orchestrator — Agent #226.
 * Coordination only. Never owns business logic or production.
 */
export {
  SYSTEM_ORCHESTRATOR_VERSION,
  coordinateStartup,
  coordinateFounderRun,
  coordinateSupervisedProduction,
  coordinateScheduledRun,
  coordinateRetry,
  coordinateCancel,
  coordinateRefresh,
  recordSystemStarted,
  loadOrchestrationSurface,
  type LifecycleStage,
  type OrchestrationEvent,
  type OrchestrationEventType,
  type OrchestrationResult,
  type OrchestrationState,
  type OrchestrationSurface,
  type OrchestrationTrigger,
  type RefreshKind,
} from "./SystemOrchestrator.js";
