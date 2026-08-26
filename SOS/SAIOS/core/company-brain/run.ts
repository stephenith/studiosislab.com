#!/usr/bin/env tsx
/**
 * Company Brain V1 CLI — Mission Contract + planning only (Agents #161/#162).
 * Never executes, enqueues, or calls providers.
 */
import { createCompanyBrain, COMPANY_BRAIN } from "./CompanyBrain.js";

const objective =
  process.argv.find((a) => a.startsWith("--objective="))?.slice("--objective=".length) ??
  "Plan an ATS-friendly Marketing Manager resume dry-run cycle via the canonical engine";

const planOnly = process.argv.includes("--plan-only");

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("Company Brain CLI refuses SOS_AIOS_LIVE=1");
  }

  console.log(
    JSON.stringify(
      {
        module: COMPANY_BRAIN.module,
        version: COMPANY_BRAIN.version,
        mode: COMPANY_BRAIN.mode,
        autonomous: COMPANY_BRAIN.autonomous,
        replaces_executive_orchestrator: COMPANY_BRAIN.replaces_executive_orchestrator,
        mission_contract: COMPANY_BRAIN.mission_contract,
      },
      null,
      2,
    ),
  );

  const brain = createCompanyBrain();

  if (planOnly) {
    const result = brain.createPlan({ founder_objective: objective });
    console.log(
      JSON.stringify(
        {
          overall: result.overall,
          plan_id: result.plan.plan_id,
          mission_id: result.plan.mission_id,
          execution_status: result.plan.execution_status,
          founder_approval_required: result.plan.founder_approval_required,
          execution_allowed: result.plan.execution_allowed,
          queue_enqueue_allowed: result.plan.queue_enqueue_allowed,
          risk_level: result.plan.risk_level,
          blocking_issues: result.plan.blocking_issues.length,
          departments: result.plan.recommended_order,
          artifacts: result.artifact_paths,
          status: {
            planning_state: result.status.planning_state,
            pending_approval: result.status.pending_approval,
            can_execute: result.status.can_execute,
          },
        },
        null,
        2,
      ),
    );
    if (result.plan.execution_allowed !== false) process.exit(1);
    if (result.plan.queue_enqueue_allowed !== false) process.exit(1);
    return;
  }

  const result = brain.createMission({
    founder_objective: objective,
    await_founder: true,
  });

  console.log(
    JSON.stringify(
      {
        overall: result.overall,
        mission_id: result.mission.mission_id,
        mission_name: result.mission.mission_name,
        mission_status: result.mission.status,
        priority: result.mission.priority,
        risk_level: result.mission.risk_level,
        linked_plan_id: result.plan_id,
        founder_approval_required: result.mission.founder_approval_required,
        execution_allowed: result.mission.execution_allowed,
        queue_admission_allowed: result.mission.queue_admission_allowed,
        publishing_allowed: result.mission.publishing_allowed,
        departments: result.mission.estimated_departments
          .filter((d) => d.role_in_plan === "primary" || d.role_in_plan === "supporting")
          .map((d) => d.department),
        critical_path: result.mission.dependency_graph.critical_path,
        validation_errors: result.validation.errors.length,
        artifacts: result.artifact_paths,
      },
      null,
      2,
    ),
  );

  if (result.overall !== "PASS") process.exit(1);
  if (result.mission.execution_allowed !== false) process.exit(1);
  if (result.mission.queue_admission_allowed !== false) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
