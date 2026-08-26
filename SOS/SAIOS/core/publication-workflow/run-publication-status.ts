/**
 * CLI: npm run aios:publication:status
 * Optional: --candidate-id=<id> | --plan-id=<id>
 */
import {
  getCandidatePublicationStatus,
  getPublicationStatusOverview,
} from "./PublicationStatusService.js";
import { listReconciliationProposals } from "./LifecycleReconciliation.js";
import { getExecutionStatusProjection } from "./execution/PublicationExecutor.js";
import { readPlanReservationLedger } from "./execution/PlanReservationLedger.js";
import { readLock } from "./execution/PublicationLock.js";
import { listActivePlans, readPlan } from "./PublicationPlanService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function main(): void {
  const candidateId = arg("candidate-id");
  if (candidateId) {
    console.log(
      JSON.stringify(getCandidatePublicationStatus(candidateId), null, 2),
    );
    return;
  }

  const planId = arg("plan-id");
  if (planId) {
    const plan = readPlan(planId);
    const projection = getExecutionStatusProjection(planId);
    const lock = readLock(planId);
    const reservations = readPlanReservationLedger(planId);
    console.log(
      JSON.stringify(
        {
          plan_id: planId,
          plan_status: plan?.status ?? null,
          plan_entries: plan?.entries.map((e) => ({
            candidate_id: e.candidate_id,
            title: e.title,
            catalogue_id: e.proposed_catalogue_id,
          })),
          execution_status: projection.execution?.status ?? null,
          current_phase: projection.execution?.current_phase ?? null,
          per_entry_progress:
            projection.execution?.entries.map((e) => ({
              candidate_id: e.candidate_id,
              catalogue_id: e.catalogue_id,
              completed_steps: e.completed_steps,
              error: e.error,
            })) ?? null,
          catalogue_reservations: reservations,
          git_commit_sha: projection.execution?.git_commit_sha ?? null,
          push_state: {
            pushed: projection.execution?.git_pushed ?? false,
            remote: projection.execution?.push_remote ?? null,
            branch: projection.execution?.git_branch ?? null,
          },
          deployment_state: {
            verified: projection.execution?.deployment_verified ?? false,
            deployment_id: projection.execution?.deployment_id ?? null,
          },
          live_verification: projection.execution?.live_urls ?? null,
          lifecycle_reconciled:
            projection.execution?.lifecycle_reconciled ?? false,
          lock,
          recoverable_error: projection.execution?.error ?? null,
          next_retry_action: projection.next_retry_action,
          publication_allowed: false,
          live: false,
        },
        null,
        2,
      ),
    );
    return;
  }

  const overview = getPublicationStatusOverview();
  const reconciliation = listReconciliationProposals();
  const active = listActivePlans();
  const executions = active.map((p) => getExecutionStatusProjection(p.plan_id));
  console.log(
    JSON.stringify(
      {
        ...overview,
        reconciliation_proposals: reconciliation,
        active_executions: executions,
      },
      null,
      2,
    ),
  );
}

main();
