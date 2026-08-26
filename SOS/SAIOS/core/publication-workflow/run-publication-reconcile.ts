/**
 * CLI: npm run aios:publication:reconcile -- --candidate-id=<id> [--apply]
 * Optional: --plan-id=<id> to project execution evidence only (no website writes).
 * Safe lifecycle-only reconciliation. Never republishes. Never invents publication.
 */
import {
  proposeMarketingT101Reconciliation,
  reconcilePublishedLifecycle,
} from "./LifecycleReconciliation.js";
import { getExecutionStatusProjection } from "./execution/PublicationExecutor.js";
import { findExecutionForPlan } from "./execution/ExecutionJournal.js";
import { readPlan } from "./PublicationPlanService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function main(): void {
  const planId = arg("plan-id");
  if (planId) {
    const plan = readPlan(planId);
    const exec = findExecutionForPlan(planId);
    const projection = getExecutionStatusProjection(planId);
    console.log(
      JSON.stringify(
        {
          mode: "execution_projection",
          plan_id: planId,
          plan_status: plan?.status ?? null,
          execution_status: exec?.status ?? null,
          phases_completed: exec?.phases_completed ?? [],
          git_commit_sha: exec?.git_commit_sha ?? null,
          git_pushed: exec?.git_pushed ?? false,
          deployment_verified: exec?.deployment_verified ?? false,
          lifecycle_reconciled: exec?.lifecycle_reconciled ?? false,
          pretends_publication: false,
          website_writes: false,
          next_retry_action: projection.next_retry_action,
          note: "Reconcile repairs projection from durable evidence only — does not publish",
        },
        null,
        2,
      ),
    );
    return;
  }

  const candidateId = arg("candidate-id");
  const apply = hasFlag("apply");
  if (!candidateId) {
    const proposal = proposeMarketingT101Reconciliation();
    console.log(JSON.stringify({ proposal, applied: false }, null, 2));
    return;
  }
  const proposal = reconcilePublishedLifecycle({
    candidate_id: candidateId,
    apply,
    git_commit_sha: arg("git-commit"),
  });
  console.log(JSON.stringify(proposal, null, 2));
}

main();
