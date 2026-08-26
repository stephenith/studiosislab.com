/**
 * SAIOS Shadow Mode — public exports
 */

export { ShadowCoordinator, createLegacyShadowHandler } from "./ShadowCoordinator.js";
export type { ShadowCoordinatorOptions, ShadowProcessResult } from "./ShadowCoordinator.js";
export { ShadowComparator } from "./ShadowComparator.js";
export { ShadowReport } from "./ShadowReport.js";
export { ShadowCursorExecutor, buildShadowPrompt } from "./ShadowCursorExecutor.js";
export { resolveShadowPaths, shadowWorkspaceRel } from "./paths.js";

export type {
  LegacyShadowOutcome,
  SaiosShadowOutcome,
  ShadowComparisonMetrics,
  ShadowComparisonResult,
  ShadowCommandRecord,
  ShadowRunReport,
  LegacyShadowHandler,
} from "./types.js";
