/**
 * Durable multi-candidate publication execution contracts.
 */
export type ExecutionPhase =
  | "PREPARED"
  | "EXPORTING"
  | "WEBSITE_WRITES_PREPARED"
  | "WEBSITE_WRITES_APPLIED"
  | "COMMITTED"
  | "PUSHED"
  | "DEPLOYMENT_VERIFIED"
  | "LIFECYCLE_RECONCILED"
  | "COMPLETED";

export type ExecutionStatus =
  | ExecutionPhase
  | "FAILED_RECOVERABLE"
  | "FAILED_TERMINAL"
  | "DRY_RUN";

export type EntryStep =
  | "reserved"
  | "exported"
  | "assets_ready"
  | "website_prepared"
  | "website_applied"
  | "live_verified"
  | "lifecycle_published";

export type ExecutionEntryState = {
  candidate_id: string;
  title: string;
  staging_package_id: string;
  catalogue_id: string;
  decision_id: string;
  generation_id: string;
  completed_steps: EntryStep[];
  export_package_id: string | null;
  reservation_id: string | null;
  generated_files: string[];
  file_checksums: Record<string, string>;
  live_url: string | null;
  lifecycle_status: string | null;
  error: string | null;
};

export type PublicationExecution = {
  schema_version: "publication-execution-1.0.0";
  plan_id: string;
  execution_id: string;
  started_at: string;
  updated_at: string;
  status: ExecutionStatus;
  current_phase: ExecutionPhase | "FAILED_RECOVERABLE" | "FAILED_TERMINAL" | "DRY_RUN";
  mode: "dry_run" | "execute" | "simulate";
  eligibility_fingerprint: string;
  confirm_phrase: string;
  entries: ExecutionEntryState[];
  phases_completed: ExecutionPhase[];
  generated_files_all: string[];
  rollback_manifest_path: string | null;
  git_commit_sha: string | null;
  git_branch: string | null;
  git_pushed: boolean;
  push_remote: string | null;
  deployment_id: string | null;
  deployment_verified: boolean;
  live_urls: Record<string, string>;
  lifecycle_reconciled: boolean;
  error: string | null;
  retry_count: number;
  recovery_instructions: string[];
  publication_allowed: false;
  live: false;
};

export type PublicationLockRecord = {
  schema_version: "publication-lock-1.0.0";
  plan_id: string;
  execution_id: string;
  acquired_at: string;
  updated_at: string;
  holder_pid: number;
  mode: "execute" | "simulate";
  stale_after_ms: number;
};

export const PHASE_ORDER: ExecutionPhase[] = [
  "PREPARED",
  "EXPORTING",
  "WEBSITE_WRITES_PREPARED",
  "WEBSITE_WRITES_APPLIED",
  "COMMITTED",
  "PUSHED",
  "DEPLOYMENT_VERIFIED",
  "LIFECYCLE_RECONCILED",
  "COMPLETED",
];

export function nextPhase(current: ExecutionPhase): ExecutionPhase | null {
  const i = PHASE_ORDER.indexOf(current);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1]!;
}
