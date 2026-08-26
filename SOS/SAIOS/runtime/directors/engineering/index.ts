/**
 * Engineering Director — public exports
 */

export { EngineeringDirector } from "./EngineeringDirector.js";
export type { EngineeringDirectorOptions } from "./EngineeringDirector.js";
export { EngineeringPlanner } from "./EngineeringPlanner.js";
export { EngineeringDelegator } from "./EngineeringDelegator.js";
export { EngineeringReporter } from "./EngineeringReporter.js";
export { EngineeringExecutionCoordinator } from "./EngineeringExecutionCoordinator.js";
export type { EngineeringExecutionCoordinatorOptions } from "./EngineeringExecutionCoordinator.js";
export {
  buildEngineeringExecutionReport,
  writeEngineeringExecutionReport,
} from "./EngineeringExecutionReport.js";
export type {
  EngineeringExecutionReport,
  EngineeringExecutionStatus,
} from "./EngineeringExecutionReport.js";
export {
  buildWorkerExecutionContext,
  jobWithExecutionContext,
} from "./WorkerExecutionContext.js";
export type {
  WorkerExecutionContext,
  WorkerExecutionInput,
  ExecutionMode,
} from "./WorkerExecutionContext.js";
export { DynamicWorkforceManager } from "./DynamicWorkforceManager.js";
export type {
  DynamicWorkforceManagerOptions,
  WorkforceScalingReport,
  ScalingCycleResult,
} from "./DynamicWorkforceManager.js";
export { WorkloadAnalyzer } from "./WorkloadAnalyzer.js";
export type { WorkloadSnapshot } from "./WorkloadAnalyzer.js";
export { CapacityPlanner } from "./CapacityPlanner.js";
export type { CapacityEstimate } from "./CapacityPlanner.js";
export {
  WorkerScalingPolicy,
  DEFAULT_SCALING_POLICY,
} from "./WorkerScalingPolicy.js";
export type {
  ScalingAction,
  ScalingActionType,
  WorkerScalingPolicyConfig,
} from "./WorkerScalingPolicy.js";
export {
  ENGINEERING_WORKER_TYPES,
  FORBIDDEN_DIRECTOR_ACTIONS,
  assertAllowedDirectorAction,
  directorScopeNote,
  getWorkerTypeById,
  getWorkerTypeByCapability,
} from "./EngineeringPolicies.js";
export { resolveEngineeringPaths, engineeringReportPath, engineeringExecutionReportPath, engineeringExecutionOutputDir, workforceScalingReportPath } from "./paths.js";

export type {
  EngineeringObjective,
  EngineeringPlan,
  EngineeringTask,
  EngineeringDependency,
  EngineeringWorkerTypeDefinition,
  WorkerRequestResult,
  JobAssignment,
  DelegationResult,
  EngineeringProgress,
  EngineeringMetrics,
  EngineeringSummary,
  EngineeringCompletionReport,
  EngineeringDirectorResult,
} from "./types.js";
