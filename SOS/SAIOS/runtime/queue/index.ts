/**
 * SAIOS Job Queue module — public exports (v1 production)
 */

export type {
  JobArtifact,
  SaiosJob,
  CreateJobInput,
  JobStatusUpdate,
  JobEventRecord,
  QueuePaths,
  JobRecord,
  EnqueueInput,
  QueueService,
} from "./types.js";

export type { QueueJobStatus } from "./job-status.js";
export {
  TERMINAL_JOB_STATUSES,
  VALID_STATUS_TRANSITIONS,
} from "./job-status.js";

export { QueueManager, comparePriority } from "./QueueManager.js";
export { QueueStorage } from "./QueueStorage.js";
export { QueuePersistence, appendJsonlLine } from "./QueuePersistence.js";
export { QueueEvents } from "./QueueEvents.js";
export { resolveQueuePaths, jobFilePath } from "./paths.js";

/** Agent #168 — Shadow Queue (isolated; never dispatches) */
export * from "./shadow-queue-types.js";
export * from "./ShadowQueueValidator.js";
export * from "./ShadowQueueRepository.js";
export * from "./ShadowQueueReporter.js";
export * from "./ShadowQueueReceiver.js";
