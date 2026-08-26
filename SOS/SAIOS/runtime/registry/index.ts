/**
 * SAIOS Agent Registry module — public exports (v1 production)
 */

export type {
  RegistryPaths,
  SaiosWorker,
  RegisterWorkerInput,
  WorkerFilter,
  RegistryEventRecord,
  WorkerRegistration,
  WorkerCapability,
  RegistryService,
} from "./types.js";

export type { RegistryWorkerStatus } from "./worker-status.js";
export {
  TERMINAL_WORKER_STATUSES,
  ACTIVE_WORKER_STATUSES,
  VALID_WORKER_STATUS_TRANSITIONS,
  isTerminalWorkerStatus,
} from "./worker-status.js";

export { RegistryManager } from "./RegistryManager.js";
export { RegistryStorage } from "./RegistryStorage.js";
export { RegistryPersistence, appendRegistryJsonl } from "./RegistryPersistence.js";
export { RegistryEvents } from "./RegistryEvents.js";
export { resolveRegistryPaths, workerFilePath } from "./paths.js";
