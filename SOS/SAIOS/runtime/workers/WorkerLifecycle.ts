/**
 * Worker Factory — lifecycle states and transitions
 */

export type FactoryWorkerStatus =
  | "CREATED"
  | "READY"
  | "BUSY"
  | "WAITING"
  | "PAUSED"
  | "FAILED"
  | "RETIRED";

export const FACTORY_WORKER_STATUSES: readonly FactoryWorkerStatus[] = [
  "CREATED",
  "READY",
  "BUSY",
  "WAITING",
  "PAUSED",
  "FAILED",
  "RETIRED",
] as const;

export const TERMINAL_FACTORY_STATUSES: readonly FactoryWorkerStatus[] = ["RETIRED"] as const;

export const VALID_FACTORY_TRANSITIONS: Record<FactoryWorkerStatus, FactoryWorkerStatus[]> = {
  CREATED: ["READY", "RETIRED", "FAILED"],
  READY: ["BUSY", "WAITING", "PAUSED", "FAILED", "RETIRED"],
  BUSY: ["READY", "WAITING", "PAUSED", "FAILED", "RETIRED"],
  WAITING: ["READY", "BUSY", "PAUSED", "FAILED", "RETIRED"],
  PAUSED: ["READY", "RETIRED", "FAILED"],
  FAILED: ["READY", "RETIRED"],
  RETIRED: [],
};

export function canTransitionFactoryStatus(
  from: FactoryWorkerStatus,
  to: FactoryWorkerStatus,
): boolean {
  if (from === to) return true;
  return VALID_FACTORY_TRANSITIONS[from].includes(to);
}

export function assertFactoryTransition(
  from: FactoryWorkerStatus,
  to: FactoryWorkerStatus,
): void {
  if (!canTransitionFactoryStatus(from, to)) {
    throw new Error(`WorkerLifecycle: invalid transition ${from} → ${to}`);
  }
}

export function isTerminalFactoryStatus(status: FactoryWorkerStatus): boolean {
  return (TERMINAL_FACTORY_STATUSES as readonly string[]).includes(status);
}

import type { RegistryWorkerStatus } from "../registry/worker-status.js";

/** Map factory lifecycle status to Registry status (read-only mapping). */
export function factoryStatusToRegistry(status: FactoryWorkerStatus): RegistryWorkerStatus {
  switch (status) {
    case "CREATED":
      return "REGISTERED";
    case "READY":
      return "IDLE";
    case "BUSY":
      return "BUSY";
    case "WAITING":
      return "PAUSED";
    case "PAUSED":
      return "PAUSED";
    case "FAILED":
      return "ERROR";
    case "RETIRED":
      return "RETIRED";
    default:
      return "REGISTERED";
  }
}

/** Map registry status to factory lifecycle status. */
export function registryStatusToFactory(status: RegistryWorkerStatus): FactoryWorkerStatus {
  switch (status) {
    case "REGISTERED":
      return "CREATED";
    case "IDLE":
      return "READY";
    case "BUSY":
      return "BUSY";
    case "PAUSED":
      return "PAUSED";
    case "OFFLINE":
      return "WAITING";
    case "ERROR":
      return "FAILED";
    case "RETIRED":
      return "RETIRED";
    default:
      return "CREATED";
  }
}
