/**
 * Engineering Director — types
 */

import type { IsoTimestamp, JobId, Priority, WorkerId } from "../../shared/types.js";
import type { SaiosJob } from "../../queue/types.js";

export type EngineeringObjective = {
  raw_text: string;
  received_at: IsoTimestamp;
  requester?: string;
  metadata?: Record<string, unknown>;
};

export type EngineeringWorkerTypeDefinition = {
  id: string;
  name: string;
  capability: string;
  description: string;
};

export type EngineeringTask = {
  temp_key: string;
  title: string;
  description: string;
  worker_type: string;
  capability: string;
  priority: Priority;
  step: number;
  depends_on?: string[];
};

export type EngineeringDependency = {
  from: string;
  to: string;
  kind: "sequential" | "qa" | "docs";
};

export type EngineeringPlan = {
  id: string;
  goal: string;
  priority: Priority;
  worker_types: string[];
  tasks: EngineeringTask[];
  estimated_workers: number;
  estimated_jobs: number;
  estimated_duration: string;
  dependencies: EngineeringDependency[];
  created_at: IsoTimestamp;
  objective: EngineeringObjective;
};

export type WorkerRequestResult = {
  worker_type: string;
  worker_id: WorkerId;
  requested: boolean;
  registered: boolean;
};

export type JobAssignment = {
  task_key: string;
  job_id: JobId;
  worker_id: WorkerId;
  worker_type: string;
};

export type DelegationResult = {
  plan_id: string;
  worker_requests: WorkerRequestResult[];
  job_ids: JobId[];
  assignments: JobAssignment[];
};

export type EngineeringProgress = {
  plan_id: string;
  total_jobs: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  overall_percent: number;
  updated_at: IsoTimestamp;
};

export type EngineeringMetrics = {
  plan_id: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  workers_used: number;
  worker_types_used: string[];
  duration_estimate: string;
};

export type EngineeringSummary = {
  plan_id: string;
  goal: string;
  success: boolean;
  headline: string;
  tasks_completed: number;
  tasks_total: number;
};

export type EngineeringCompletionReport = {
  plan_id: string;
  goal: string;
  priority: Priority;
  finished_at: IsoTimestamp;
  summary: EngineeringSummary;
  metrics: EngineeringMetrics;
  progress: EngineeringProgress;
  job_reports: Array<{
    job_id: JobId;
    title: string;
    worker_type: string;
    status: string;
    assigned_worker: WorkerId | null;
  }>;
  report_path: string;
};

export type EngineeringDirectorResult = {
  plan: EngineeringPlan;
  delegation: DelegationResult;
  progress: EngineeringProgress;
  report: EngineeringCompletionReport;
};
