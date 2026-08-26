/**
 * SAIOS Job Queue — types (v1 production)
 */

import type { IsoTimestamp, JobId, Priority, WorkerId } from "../shared/types.js";
import type { QueueJobStatus } from "./job-status.js";

export type JobArtifact = {
  kind: string;
  path: string;
  created_at: IsoTimestamp;
  metadata?: Record<string, unknown>;
};

export type SaiosJob = {
  id: JobId;
  title: string;
  description: string;
  priority: Priority;
  creator: string;
  assigned_worker: WorkerId | null;
  status: QueueJobStatus;
  parent_job: JobId | null;
  child_jobs: JobId[];
  dependencies: JobId[];
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  started_at: IsoTimestamp | null;
  completed_at: IsoTimestamp | null;
  report_path: string | null;
  artifacts: JobArtifact[];
  metadata: Record<string, unknown>;
};

export type CreateJobInput = {
  title: string;
  description: string;
  priority?: Priority;
  creator?: string;
  parent_job?: JobId | null;
  dependencies?: JobId[];
  assigned_worker?: WorkerId | null;
  status?: QueueJobStatus;
  report_path?: string | null;
  artifacts?: JobArtifact[];
  metadata?: Record<string, unknown>;
  id?: JobId;
};

export type JobStatusUpdate = {
  status: QueueJobStatus;
  note?: string;
  report_path?: string | null;
  artifacts?: JobArtifact[];
};

export type JobEventRecord = {
  event_id: string;
  job_id: JobId;
  from_status: QueueJobStatus | null;
  to_status: QueueJobStatus;
  at: IsoTimestamp;
  actor: string;
  note?: string;
  metadata?: Record<string, unknown>;
};

export type QueuePaths = {
  jobsDir: string;
  eventsFile: string;
};

/** @deprecated Use SaiosJob — retained for skeleton compatibility */
export type JobRecord = SaiosJob;

export type EnqueueInput = CreateJobInput;

export interface QueueService {
  enqueue(input: EnqueueInput): Promise<SaiosJob>;
  dequeue(): Promise<SaiosJob | null>;
  cancel(jobId: JobId, reason: string): Promise<SaiosJob>;
  complete(jobId: JobId, reportPath?: string): Promise<SaiosJob>;
  block(jobId: JobId, reason: string): Promise<SaiosJob>;
  resume(jobId: JobId, note?: string): Promise<SaiosJob>;
}
