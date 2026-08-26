/**
 * SAIOS QA Runner module — types
 */

import type { IsoTimestamp, JobId, QAVerdict, VerifyProfile, WorkerId } from "../shared/types.js";

export type VerificationRequest = {
  job_id: JobId;
  parent_job_id: JobId;
  profile: VerifyProfile;
  report_path?: string;
  acceptance_criteria?: string[];
};

export type VerificationResult = {
  job_id: JobId;
  parent_job_id: JobId;
  worker_id: WorkerId;
  verdict: QAVerdict;
  profile: VerifyProfile;
  checks: Array<{ id: string; passed: boolean; notes: string }>;
  finished_at: IsoTimestamp;
  error?: string | null;
};

export interface QARunnerService {
  requestVerification(request: VerificationRequest): Promise<JobId>;
  receiveVerification(jobId: JobId): Promise<VerificationResult>;
}
