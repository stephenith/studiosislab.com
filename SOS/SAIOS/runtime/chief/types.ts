/**
 * SAIOS Executive Orchestrator — types (v1 production)
 */

import type { IsoTimestamp, JobId, PlanId, Priority } from "../shared/types.js";
import type { SaiosJob } from "../queue/types.js";
import type { SaiosWorker } from "../registry/types.js";

export type FounderCommandSource = "telegram" | "api" | "schedule" | "verify";

export type FounderCommand = {
  source: FounderCommandSource;
  raw_text: string;
  chat_id?: string;
  user_id?: string;
  received_at: IsoTimestamp;
};

export type ChiefCommandResult = {
  accepted: boolean;
  reply: string;
  plan_id?: PlanId;
  job_ids?: JobId[];
};

/** One step in an execution plan before queue persistence */
export type PlannedJob = {
  temp_key: string;
  title: string;
  description: string;
  priority: Priority;
  required_capability: string;
  step: number;
  depends_on?: string[];
  metadata?: Record<string, unknown>;
};

/** One founder request → one execution plan */
export type ExecutionPlan = {
  id: PlanId;
  goal: string;
  summary: string;
  priority: Priority;
  jobs: PlannedJob[];
  estimated_workers: number;
  estimated_steps: number;
  estimated_duration: string;
  created_at: IsoTimestamp;
  founder_command: FounderCommand;
};

export type DecisionResult = {
  goal: string;
  summary: string;
  priority: Priority;
  implement_steps: number;
  include_verify: boolean;
  estimated_duration: string;
};

export type WorkerAssignment = {
  job_id: JobId;
  worker_id: SaiosWorker["id"];
  required_capability: string;
  priority: Priority;
  step: number;
};

export type ProgressSnapshot = {
  plan_id: PlanId | null;
  overall_percent: number;
  total_jobs: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  blocked: number;
  updated_at: IsoTimestamp;
};

export type JobReportSummary = {
  job_id: JobId;
  title: string;
  status: string;
  assigned_worker: string | null;
  report_path: string | null;
};

export type CompletionReport = {
  plan_id: PlanId;
  goal: string;
  summary: string;
  finished_at: IsoTimestamp;
  progress: ProgressSnapshot;
  job_reports: JobReportSummary[];
  success: boolean;
};

export interface ExecutiveOrchestratorService {
  receiveFounderCommand(command: FounderCommand): Promise<ChiefCommandResult>;
  createExecutionPlan(command: FounderCommand): Promise<ExecutionPlan>;
  createJobs(plan: ExecutionPlan): Promise<SaiosJob[]>;
  selectWorkers(plan: ExecutionPlan, jobs: SaiosJob[]): Promise<WorkerAssignment[]>;
  assignJobs(assignments: WorkerAssignment[]): Promise<void>;
  trackExecution(planId?: PlanId): Promise<ProgressSnapshot>;
  collectReports(jobIds: JobId[]): Promise<JobReportSummary[]>;
  finishExecution(planId: PlanId): Promise<CompletionReport>;
}
