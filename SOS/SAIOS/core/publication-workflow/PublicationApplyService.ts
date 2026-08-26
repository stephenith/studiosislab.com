/**
 * Publication apply — gated, fail-closed, durable multi-candidate executor.
 *
 * Dry-run (default): re-verify + calculate phases; no locks, reservations,
 * website writes, commits, pushes, or lifecycle changes.
 *
 * Execute: requires --execute + SOS_AIOS_PUBLICATION_APPLY=1 + LIVE OFF.
 */
import {
  readLifecycle,
  upsertLifecycle,
} from "../staging/CandidateLifecycleStore.js";
import { assertTransition } from "../staging/TemplateLifecycle.js";
import {
  defaultPublicationRoots,
  type PublicationRoots,
} from "./paths.js";
import {
  runPublicationExecutor,
  type ExecutorMode,
} from "./execution/PublicationExecutor.js";
import type { SimulateHooks } from "./execution/adapters.js";
import type { PublicationApplyRecord, PublicationPlan } from "./types.js";
import type { PublicationExecution } from "./execution/types.js";

export type ApplyInput = {
  plan_id: string;
  confirm_phrase: string;
  /** Must be true AND env SOS_AIOS_PUBLICATION_APPLY=1 for real writes. */
  execute_writes?: boolean;
  /** Test / rehearsal mode — fixture roots + simulate adapters. */
  simulate?: boolean;
  simulate_hooks?: SimulateHooks;
  force_stale_lock?: boolean;
  crash_after_phase?: Parameters<
    typeof runPublicationExecutor
  >[0]["crash_after_phase"];
  actor?: string;
};

/**
 * Apply a verified publication plan via the durable executor.
 */
export async function applyPublicationPlan(
  input: ApplyInput,
  roots: PublicationRoots = defaultPublicationRoots(),
): Promise<{
  ok: boolean;
  plan: PublicationPlan | null;
  apply: PublicationApplyRecord;
  execution: PublicationExecution | null;
}> {
  let mode: ExecutorMode = "dry_run";
  if (input.simulate) mode = "simulate";
  else if (input.execute_writes) mode = "execute";

  return runPublicationExecutor(
    {
      plan_id: input.plan_id,
      confirm_phrase: input.confirm_phrase,
      mode,
      actor: input.actor,
      force_stale_lock: input.force_stale_lock,
      simulate_hooks: input.simulate_hooks,
      crash_after_phase: input.crash_after_phase,
    },
    roots,
  );
}

/**
 * Mark candidates PUBLISHED only after live verification evidence is supplied.
 * Used by reconciliation / apply completion — never speculative.
 */
export function markPublishedAfterLiveVerification(input: {
  candidate_id: string;
  catalogue_id: string;
  release_id: string;
  git_commit_sha: string;
  deployment_id: string | null;
  live_url: string;
  published_at: string;
  live_verified: true;
}): void {
  if (input.live_verified !== true) {
    throw new Error("live_verified must be true");
  }
  if (!input.live_url || !input.git_commit_sha || !input.release_id) {
    throw new Error("live URL, commit SHA, and release_id required");
  }
  const life = readLifecycle(input.candidate_id);
  if (!life) throw new Error(`No lifecycle for ${input.candidate_id}`);
  if (life.lifecycle_status === "PUBLISHED") return;
  assertTransition(life.lifecycle_status, "PUBLISHED");
  upsertLifecycle({
    ...life,
    lifecycle_status: "PUBLISHED",
  });
}
