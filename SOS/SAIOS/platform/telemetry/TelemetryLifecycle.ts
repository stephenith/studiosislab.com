/**
 * TelemetryLifecycle — Agent #183.
 * CREATED → READY → ATTACHED → FROZEN
 */
import {
  BaseLifecycleStateMachine,
  DEFAULT_EXECUTION_BLOCKED_TARGETS,
} from "../state-machine/BaseLifecycleStateMachine.js";
import type { TelemetryLifecycleStatus } from "./TelemetryTypes.js";

export const TELEMETRY_LIFECYCLE_TRANSITIONS: Partial<
  Record<TelemetryLifecycleStatus, TelemetryLifecycleStatus[]>
> = {
  CREATED: ["READY", "FROZEN"],
  READY: ["ATTACHED", "FROZEN"],
  ATTACHED: ["FROZEN"],
  FROZEN: [],
};

const machine = new BaseLifecycleStateMachine(
  TELEMETRY_LIFECYCLE_TRANSITIONS as Record<string, readonly string[]>,
  [
    ...DEFAULT_EXECUTION_BLOCKED_TARGETS,
    "COLLECTING",
    "STREAMING",
    "EMITTED",
  ],
);

export function canTelemetryLifecycleTransition(
  from: TelemetryLifecycleStatus,
  to: TelemetryLifecycleStatus,
): boolean {
  return machine.can(from, to);
}

export function assertTelemetryLifecycleTransition(
  from: TelemetryLifecycleStatus,
  to: TelemetryLifecycleStatus,
): void {
  machine.assert(from, to, "telemetry-lifecycle");
}

export function isTelemetryCollectionPossible(
  _status: TelemetryLifecycleStatus,
): false {
  return false;
}
