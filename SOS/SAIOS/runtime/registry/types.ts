/**
 * SAIOS Agent Registry — types (v1 production)
 */

import type { IsoTimestamp, JobId, WorkerId } from "../shared/types.js";
import type { RegistryWorkerStatus } from "./worker-status.js";

export type RegistryPaths = {
  registryDir: string;
  eventsFile: string;
};

export type SaiosWorker = {
  id: WorkerId;
  name: string;
  type: string;
  version: string;
  status: RegistryWorkerStatus;
  capabilities: string[];
  current_job: JobId | null;
  parent_worker: WorkerId | null;
  child_workers: WorkerId[];
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  last_heartbeat: IsoTimestamp;
  host: string;
  runtime: string;
  metadata: Record<string, unknown>;
};

export type RegisterWorkerInput = {
  id?: WorkerId;
  name: string;
  type: string;
  version: string;
  capabilities: string[];
  host?: string;
  runtime?: string;
  parent_worker?: WorkerId | null;
  status?: RegistryWorkerStatus;
  metadata?: Record<string, unknown>;
};

export type WorkerFilter = {
  status?: RegistryWorkerStatus;
  type?: string;
  capability?: string;
};

export type RegistryEventRecord = {
  event_id: string;
  worker_id: WorkerId;
  action: string;
  from_status: RegistryWorkerStatus | null;
  to_status: RegistryWorkerStatus | null;
  at: IsoTimestamp;
  actor: string;
  note?: string;
  metadata?: Record<string, unknown>;
};

/** @deprecated Use SaiosWorker */
export type WorkerRegistration = SaiosWorker;

export type WorkerCapability = string;

export interface RegistryService {
  registerWorker(input: RegisterWorkerInput): Promise<SaiosWorker>;
  retireWorker(workerId: WorkerId): Promise<SaiosWorker>;
  findWorker(filter: WorkerFilter): Promise<SaiosWorker | null>;
  listWorkers(filter?: WorkerFilter): Promise<SaiosWorker[]>;
}
