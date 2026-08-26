/**
 * Worker Factory — standardized worker object
 */

import type { IsoTimestamp, JobId, Priority, WorkerId } from "../shared/types.js";
import type { FactoryWorkerStatus } from "./WorkerLifecycle.js";

export type FactoryWorker = {
  worker_id: WorkerId;
  worker_type: string;
  display_name: string;
  status: FactoryWorkerStatus;
  capabilities: string[];
  priority: Priority;
  parent_director: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  heartbeat: IsoTimestamp | null;
  current_job: JobId | null;
  metadata: Record<string, unknown>;
};

export type CreateWorkerInput = {
  worker_type: string;
  display_name?: string;
  capabilities?: string[];
  priority?: Priority;
  parent_director?: string | null;
  metadata?: Record<string, unknown>;
  worker_id?: WorkerId;
};

export type WorkerDefinitionRecord = {
  worker_type: string;
  display_name: string;
  default_capabilities: string[];
  default_priority: Priority;
  description: string;
  parent_director: string;
};

export type SerializedWorker = string;
