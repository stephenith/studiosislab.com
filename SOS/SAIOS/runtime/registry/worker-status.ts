/**
 * SAIOS Agent Registry — worker status lifecycle (v1 production)
 */

export type RegistryWorkerStatus =
  | "REGISTERED"
  | "IDLE"
  | "BUSY"
  | "PAUSED"
  | "OFFLINE"
  | "ERROR"
  | "RETIRED";

export const TERMINAL_WORKER_STATUSES: readonly RegistryWorkerStatus[] = ["RETIRED"] as const;

export const ACTIVE_WORKER_STATUSES: readonly RegistryWorkerStatus[] = [
  "REGISTERED",
  "IDLE",
  "BUSY",
  "PAUSED",
  "OFFLINE",
  "ERROR",
] as const;

export const VALID_WORKER_STATUS_TRANSITIONS: Record<
  RegistryWorkerStatus,
  RegistryWorkerStatus[]
> = {
  REGISTERED: ["IDLE", "OFFLINE", "RETIRED", "ERROR"],
  IDLE: ["BUSY", "PAUSED", "OFFLINE", "RETIRED", "ERROR"],
  BUSY: ["IDLE", "PAUSED", "OFFLINE", "RETIRED", "ERROR"],
  PAUSED: ["IDLE", "OFFLINE", "RETIRED"],
  OFFLINE: ["IDLE", "REGISTERED", "RETIRED", "ERROR"],
  ERROR: ["IDLE", "OFFLINE", "RETIRED"],
  RETIRED: [],
};

export function isTerminalWorkerStatus(status: RegistryWorkerStatus): boolean {
  return (TERMINAL_WORKER_STATUSES as readonly string[]).includes(status);
}
