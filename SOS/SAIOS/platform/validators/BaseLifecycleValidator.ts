/**
 * BaseLifecycleValidator — Agent #173.
 * Generic status / transition validation helpers.
 */
import type { PlatformValidationIssue } from "../checksums/index.js";
import { canTransition as platformCanTransition } from "../state-machine/BaseLifecycleStateMachine.js";

export class BaseLifecycleValidator {
  requireStatus(
    actual: string | null | undefined,
    allowed: readonly string[],
    code = "INVALID_STATUS",
    field = "status",
  ): PlatformValidationIssue | null {
    if (!actual || !allowed.includes(actual)) {
      return {
        code,
        message: `Status must be one of [${allowed.join(", ")}] (got ${actual ?? "missing"})`,
        field,
      };
    }
    return null;
  }

  requireTransition(
    from: string,
    to: string,
    transitions: Partial<Record<string, readonly string[]>>,
    code = "INVALID_TRANSITION",
  ): PlatformValidationIssue | null {
    if (!platformCanTransition(from, to, transitions)) {
      return {
        code,
        message: `Invalid transition: ${from} → ${to}`,
        field: "status",
      };
    }
    return null;
  }

  rejectExecutionStates(
    to: string,
    blocked: readonly string[] = [
      "IN_PROGRESS",
      "COMPLETED",
      "QUEUED",
      "DISPATCHED",
      "RUNNING",
      "EXECUTING",
      "SCHEDULED",
      "STARTED",
      "LIVE",
    ],
  ): PlatformValidationIssue | null {
    if (blocked.includes(to)) {
      return {
        code: "EXECUTION_STATE_FORBIDDEN",
        message: `Execution state '${to}' is forbidden`,
        field: "status",
      };
    }
    return null;
  }
}
