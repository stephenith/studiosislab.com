/**
 * Phase 5L — Founder APPROVE → automatic staging handoff.
 * Persists approval first (caller). Staging failures never revoke APPROVED.
 * Never publishes. Never stages fixtures/debug/test rows.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  listApprovedForStaging,
  stageApprovedCandidate,
} from "./StagingService.js";
import { readLifecycle } from "./CandidateLifecycleStore.js";
import type { CandidateLifecycleRecord, StageApprovedResult } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const DEFAULT_CANDIDATES_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);

export type AutoStageSkipReason =
  | "not_approved"
  | "fixture_or_debug"
  | "superseded"
  | "already_published"
  | "already_staged_or_validated"
  | "missing_candidate"
  | "no_candidate_id";

export type AutoStageHandoffResult = {
  attempted: boolean;
  skipped: boolean;
  skip_reason: AutoStageSkipReason | null;
  staging: StageApprovedResult | null;
  publication_allowed: false;
};

type CandidateManifestLite = {
  candidate_id?: string;
  fixture?: boolean;
  debug?: boolean;
  test?: boolean;
  superseded_by_revision?: string;
};

export type AutoStageDeps = {
  candidatesRoot?: string;
  stageFn?: typeof stageApprovedCandidate;
  readLife?: (candidateId: string) => CandidateLifecycleRecord | null;
};

/**
 * Repository evidence for non-production rows (fixtures / debug / test).
 * Do not hard-code live Resume Template IDs.
 */
export function isNonProductionResumeTemplate(
  candidateId: string,
  candidatesRoot: string = DEFAULT_CANDIDATES_ROOT,
): boolean {
  const id = candidateId.toLowerCase();
  if (
    id.includes("fixture") ||
    id.includes("-debug-") ||
    id.includes("_debug_") ||
    id.includes("-test-") ||
    id.startsWith("cand-test-") ||
    id.includes("aios-242") ||
    id.includes("aios-243")
  ) {
    return true;
  }
  const manifestPath = join(candidatesRoot, candidateId, "candidate.json");
  if (!existsSync(manifestPath)) return false;
  try {
    const m = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as CandidateManifestLite;
    if (m.fixture === true || m.debug === true || m.test === true) return true;
  } catch {
    /* treat as production if unreadable — stage will fail closed */
  }
  return false;
}

function isSuperseded(
  candidateId: string,
  candidatesRoot: string,
): boolean {
  const manifestPath = join(candidatesRoot, candidateId, "candidate.json");
  if (!existsSync(manifestPath)) return false;
  try {
    const m = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as CandidateManifestLite;
    return Boolean(m.superseded_by_revision);
  } catch {
    return false;
  }
}

/**
 * After Founder APPROVE decision + lifecycle are persisted, stage once.
 * Safe to call on duplicates — stageApprovedCandidate is idempotent by decision.
 */
export async function autoStageAfterFounderApproval(
  input: {
    candidate_id: string | null | undefined;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    decision_id: string;
    actor?: string;
  },
  deps: AutoStageDeps = {},
): Promise<AutoStageHandoffResult> {
  const candidatesRoot = deps.candidatesRoot ?? DEFAULT_CANDIDATES_ROOT;
  const stageFn = deps.stageFn ?? stageApprovedCandidate;
  const readLife = deps.readLife ?? readLifecycle;

  const base: AutoStageHandoffResult = {
    attempted: false,
    skipped: true,
    skip_reason: null,
    staging: null,
    publication_allowed: false,
  };

  if (input.decision !== "APPROVED") {
    return { ...base, skip_reason: "not_approved" };
  }
  const candidateId = input.candidate_id?.trim() || null;
  if (!candidateId) {
    return { ...base, skip_reason: "no_candidate_id" };
  }
  if (isNonProductionResumeTemplate(candidateId, candidatesRoot)) {
    return { ...base, skip_reason: "fixture_or_debug" };
  }
  if (isSuperseded(candidateId, candidatesRoot)) {
    return { ...base, skip_reason: "superseded" };
  }

  const life = readLife(candidateId);
  if (life?.lifecycle_status === "PUBLISHED") {
    return { ...base, skip_reason: "already_published" };
  }
  if (
    life &&
    (life.lifecycle_status === "STAGED" ||
      life.lifecycle_status === "VALIDATED") &&
    life.staging_package_id
  ) {
    return { ...base, skip_reason: "already_staged_or_validated" };
  }

  const manifestPath = join(candidatesRoot, candidateId, "candidate.json");
  if (!existsSync(manifestPath)) {
    return { ...base, skip_reason: "missing_candidate" };
  }

  const staging = await stageFn({
    candidate_id: candidateId,
    decision_id: input.decision_id,
    actor: input.actor ?? "auto-stage-after-approve",
    allow_fixture_approval: false,
  });

  return {
    attempted: true,
    skipped: false,
    skip_reason: null,
    staging,
    publication_allowed: false,
  };
}

export type ReconcileApprovedStagingResult = {
  dry_run: boolean;
  considered: number;
  staged: Array<{
    candidate_id: string;
    title: string;
    ok: boolean;
    idempotent: boolean;
    staging_package_id: string | null;
    lifecycle_status: string | null;
    error: string | null;
  }>;
  skipped: Array<{ candidate_id: string; title: string; reason: string }>;
  publication_allowed: false;
  /** Exact watched command after VPS deploy */
  watched_command: string;
};

/**
 * Idempotent reconciliation for historical APPROVED_NOT_STAGED rows.
 * Default dry-run. Use --execute for watched staging after VPS deploy.
 * Does not publish.
 */
export async function reconcileApprovedNotStaged(input: {
  execute?: boolean;
  actor?: string;
}): Promise<ReconcileApprovedStagingResult> {
  const execute = input.execute === true;
  const approved = listApprovedForStaging();
  const staged: ReconcileApprovedStagingResult["staged"] = [];
  const skipped: ReconcileApprovedStagingResult["skipped"] = [];

  for (const row of approved) {
    if (
      row.lifecycle_status !== "APPROVED" &&
      row.lifecycle_status !== "STAGING_FAILED"
    ) {
      skipped.push({
        candidate_id: row.candidate_id,
        title: row.title,
        reason: `lifecycle ${row.lifecycle_status}`,
      });
      continue;
    }
    if (isNonProductionResumeTemplate(row.candidate_id)) {
      skipped.push({
        candidate_id: row.candidate_id,
        title: row.title,
        reason: "fixture_or_debug",
      });
      continue;
    }
    if (isSuperseded(row.candidate_id, DEFAULT_CANDIDATES_ROOT)) {
      skipped.push({
        candidate_id: row.candidate_id,
        title: row.title,
        reason: "superseded",
      });
      continue;
    }
    if (!execute) {
      skipped.push({
        candidate_id: row.candidate_id,
        title: row.title,
        reason: "dry_run_would_stage",
      });
      continue;
    }
    const result = await stageApprovedCandidate({
      candidate_id: row.candidate_id,
      actor: input.actor ?? "reconcile-approved-staging",
      allow_fixture_approval: false,
    });
    staged.push({
      candidate_id: row.candidate_id,
      title: row.title,
      ok: result.ok,
      idempotent: result.idempotent,
      staging_package_id: result.staging_package_id,
      lifecycle_status: result.lifecycle_status,
      error: result.error,
    });
  }

  return {
    dry_run: !execute,
    considered: approved.length,
    staged,
    skipped,
    publication_allowed: false,
    watched_command:
      "SOS_AIOS_LIVE=0 npm run aios:staging:reconcile-approved -- --execute",
  };
}
