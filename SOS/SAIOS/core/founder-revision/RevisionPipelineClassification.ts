/**
 * Phase 6L — runtime classification of revision-like entry points.
 *
 * Founder Request Changes has exactly one production executor.
 * Partial circuits and legacy batch paths must not be treated as
 * production-parity proof.
 */

/** PRODUCTION_REQUEST_CHANGES_ENTRY_POINT */
export const PRODUCTION_REQUEST_CHANGES_ENTRY_POINT =
  "runFounderFeedbackRevision" as const;

export const PRODUCTION_REQUEST_CHANGES_DISPATCHER =
  "dispatchRevisionTick" as const;

export const NUMBER_OF_PRODUCTION_REQUEST_CHANGES_EXECUTORS = 1;

export const TEST_ONLY_PARTIAL_CIRCUITS = [
  "runRevisionPlanGateCircuit",
] as const;

export const LEGACY_NON_REQUEST_CHANGES_PATHS = [
  "runFounderRevisionBatch",
  "reviseOne",
] as const;

export const MANUAL_CLI_WRAPPERS = [
  "run-founder-feedback-revision.ts",
] as const;

/**
 * Release proof for Founder Request Changes requires the 6L production-parity
 * harness (verify-revision-production-parity-6l.ts). Passing
 * runRevisionPlanGateCircuit alone is not sufficient.
 */
export const REVISION_RELEASE_PROOF_HARNESS =
  "verify-revision-production-parity-6l.ts" as const;
